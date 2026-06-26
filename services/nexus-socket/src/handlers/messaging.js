/**
 * Messaging handlers.
 * Handles send_message events:
 *   1. Persists the user message to PostgreSQL
 *   2. Publishes to Pub/Sub embed.messages topic for RAG indexing
 *   3. Broadcasts to room via Socket.IO (Redis adapter fans out to all pods)
 *   4. Publishes to Pub/Sub ai.inference topic if AI is triggered
 */

const { PubSub } = require('@google-cloud/pubsub');
const config = require('../config');

let pubSubClient;
let aiInferenceTopic;
let embedTopic;

/**
 * Initialize Pub/Sub client and topic reference.
 * Called once during server startup.
 */
async function initPubSub() {
  try {
    pubSubClient = new PubSub({ projectId: config.GCP_PROJECT_ID });
    aiInferenceTopic = pubSubClient.topic(config.PUBSUB_TOPIC_AI_INFERENCE);
    embedTopic = pubSubClient.topic(config.PUBSUB_TOPIC_EMBED);
    console.log('[messaging] Pub/Sub client initialized (ai.inference + embed.messages)');
  } catch (err) {
    console.warn('[messaging] Pub/Sub init failed — AI triggers disabled:', err.message);
  }
}

/**
 * Registers messaging handlers on a connected socket.
 *
 * @param {Socket} socket - The connected socket
 * @param {Server} io - The Socket.IO server instance
 * @param {Pool} pgPool - PostgreSQL connection pool
 */
function registerMessagingHandlers(socket, io, pgPool) {
  /**
   * send_message — User sends a message in a chat.
   * Payload: {
   *   chatId: string,
   *   groupId: string,
   *   tenantId: string,
   *   workspaceId: string,
   *   content: string,
   *   triggerAI?: boolean
   * }
   */
  socket.on('send_message', async (data, ack) => {
    const { chatId, groupId, tenantId, workspaceId, content, triggerAI } = data;
    const user = socket.data.user;

    // Validate required fields
    if (!chatId || !content) {
      if (typeof ack === 'function') ack({ error: 'chatId and content are required' });
      return;
    }

    if (!tenantId || !workspaceId || !groupId) {
      if (typeof ack === 'function') ack({ error: 'tenantId, workspaceId, and groupId are required' });
      return;
    }

    // Validate UUID format to prevent injection of malformed IDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (![chatId, groupId, tenantId, workspaceId].every(id => uuidRegex.test(id))) {
      if (typeof ack === 'function') ack({ error: 'Invalid UUID format' });
      return;
    }

    // Use server-side authenticated user ID, never trust client-provided user_id
    const userId = user?.uid;
    if (!userId) {
      if (typeof ack === 'function') ack({ error: 'Authentication required' });
      return;
    }

    // Validate content length to prevent abuse
    if (content.length > 50000) {
      if (typeof ack === 'function') ack({ error: 'Message too long (max 50000 characters)' });
      return;
    }

    try {
      // 1. Verify the user is a member of the workspace before allowing message send.
      //    This prevents cross-tenant data injection.
      const memberCheck = await pgPool.query(
        `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 LIMIT 1`,
        [workspaceId, userId]
      );
      if (memberCheck.rowCount === 0) {
        if (typeof ack === 'function') ack({ error: 'Not a member of this workspace' });
        return;
      }

      // 2. Insert message into PostgreSQL (use authenticated userId, not client-provided)
      const result = await pgPool.query(
        `INSERT INTO messages (tenant_id, workspace_id, group_id, chat_id, user_id, role, content)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, created_at`,
        [tenantId, workspaceId, groupId, chatId, userId, 'user', content]
      );

      const message = {
        id: result.rows[0].id,
        chatId,
        groupId,
        tenantId,
        workspaceId,
        userId,
        userName: user?.name,
        userAvatar: user?.picture || '',
        role: 'user',
        content,
        createdAt: result.rows[0].created_at,
      };

      // 3. Publish to embed topic for RAG indexing (fire-and-forget)
      if (embedTopic) {
        const embedJob = {
          content,
          tenant_id: tenantId,
          workspace_id: workspaceId,
          group_id: groupId,
          chat_id: chatId,
          user_id: userId,
          role: 'user',
          created_at: Math.floor(new Date(result.rows[0].created_at).getTime() / 1000),
        };
        embedTopic.publishMessage({
          data: Buffer.from(JSON.stringify(embedJob)),
        }).catch(err => console.warn('[messaging] Embed publish failed (non-fatal):', err.message));
      }

      // 4. Broadcast to room (Redis adapter fans out to all pods)
      io.to(`chat:${chatId}`).emit('new_message', message);
      console.log(`[messaging] Message in chat:${chatId} by ${user?.email}`);

      // 4. Trigger AI inference if requested
      if (triggerAI && aiInferenceTopic) {
        const aiJob = {
          query: content,
          tenant_id: tenantId,
          workspace_id: workspaceId,
          group_id: groupId,
          chat_id: chatId,
          user_id: userId,
        };

        await aiInferenceTopic.publishMessage({
          data: Buffer.from(JSON.stringify(aiJob)),
        });

        console.log(`[messaging] AI inference triggered for chat:${chatId}`);

        // Emit typing indicator for the AI
        io.to(`chat:${chatId}`).emit('typing_indicator', {
          userId: 'ai-assistant',
          name: 'Nexus AI',
          chatId,
          isTyping: true,
        });
      }

      if (typeof ack === 'function') ack({ success: true, messageId: message.id });
    } catch (err) {
      console.error('[messaging] send_message error:', err);
      if (typeof ack === 'function') ack({ error: 'Failed to send message' });
    }
  });

  /**
   * edit_message — User edits a previously sent message.
   * Payload: { messageId: string, chatId: string, content: string }
   */
  socket.on('edit_message', async (data) => {
    const { messageId, chatId, content } = data;
    const user = socket.data.user;

    if (!messageId || !content) return;

    try {
      await pgPool.query(
        `UPDATE messages SET content = $1, is_edited = true, updated_at = NOW()
         WHERE id = $2 AND user_id = $3`,
        [content, messageId, user?.uid]
      );

      io.to(`chat:${chatId}`).emit('message_edited', {
        messageId,
        chatId,
        content,
        editedBy: user?.uid,
      });
    } catch (err) {
      console.error('[messaging] edit_message error:', err);
    }
  });

  /**
   * delete_message — Soft-delete a message.
   * Payload: { messageId: string, chatId: string }
   */
  socket.on('delete_message', async (data) => {
    const { messageId, chatId } = data;
    const user = socket.data.user;

    if (!messageId) return;

    try {
      await pgPool.query(
        `UPDATE messages SET is_deleted = true, updated_at = NOW()
         WHERE id = $1 AND user_id = $2`,
        [messageId, user?.uid]
      );

      io.to(`chat:${chatId}`).emit('message_deleted', {
        messageId,
        chatId,
        deletedBy: user?.uid,
      });
    } catch (err) {
      console.error('[messaging] delete_message error:', err);
    }
  });

  /**
   * add_reaction — Add an emoji reaction to a message.
   * Payload: { messageId: string, chatId: string, emoji: string }
   */
  socket.on('add_reaction', async (data) => {
    const { messageId, chatId, emoji } = data;
    const user = socket.data.user;

    if (!messageId || !emoji) return;

    try {
      // Append reaction to JSONB array
      await pgPool.query(
        `UPDATE messages SET reactions = reactions || $1::jsonb
         WHERE id = $2`,
        [JSON.stringify([{ userId: user?.uid, emoji }]), messageId]
      );

      io.to(`chat:${chatId}`).emit('reaction_added', {
        messageId,
        chatId,
        userId: user?.uid,
        emoji,
      });
    } catch (err) {
      console.error('[messaging] add_reaction error:', err);
    }
  });
}

module.exports = { registerMessagingHandlers, initPubSub };
