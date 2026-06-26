/**
 * Redis client setup for Socket.IO adapter and AI stream subscription.
 *
 * Two separate responsibilities:
 * 1. Socket.IO Redis Adapter — horizontal scaling across pods
 * 2. AI Stream Subscriber — listens to room:{chatId}:ai_stream channels
 *    published by nexus-ai-worker, and relays chunks to Socket.IO rooms
 */

const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const config = require('./config');

/**
 * Sets up the Socket.IO Redis adapter for horizontal scaling.
 * Returns the adapter instance to be attached via io.adapter().
 */
async function setupRedisAdapter(io) {
  const pubClient = createClient({ url: config.REDIS_URL });
  const subClient = pubClient.duplicate();

  pubClient.on('error', (err) => console.error('[redis-adapter] Pub client error:', err.message));
  subClient.on('error', (err) => console.error('[redis-adapter] Sub client error:', err.message));

  await pubClient.connect();
  await subClient.connect();

  io.adapter(createAdapter(pubClient, subClient));
  console.log('[redis] Socket.IO Redis adapter connected');

  return { pubClient, subClient };
}

/**
 * Subscribes to AI stream channels published by nexus-ai-worker.
 * Pattern: room:{chatId}:ai_stream
 *
 * When a chunk arrives, it is emitted to the Socket.IO room for that chat.
 */
async function setupAIStreamSubscriber(io) {
  const subscriber = createClient({ url: config.REDIS_URL });
  subscriber.on('error', (err) => console.error('[redis-ai-stream] Error:', err.message));
  await subscriber.connect();

  // Use pattern subscribe to catch all chat rooms
  await subscriber.pSubscribe('room:*:ai_stream', (message, channel) => {
    try {
      const chunk = JSON.parse(message);

      // Extract chatId from channel: "room:{chatId}:ai_stream"
      const parts = channel.split(':');
      const chatId = parts.slice(1, -1).join(':'); // Handle UUIDs with colons

      // Emit to all clients in the Socket.IO room for this chat
      io.to(`chat:${chatId}`).emit('ai_stream_chunk', {
        chatId,
        delta: chunk.delta || '',
        isFinal: chunk.is_final || false,
        messageId: chunk.message_id || '',
      });

      if (chunk.is_final) {
        console.log(`[ai-stream] Final chunk for chat:${chatId}`);
      }
    } catch (err) {
      console.error('[ai-stream] Parse error:', err.message);
    }
  });

  console.log('[redis] AI stream subscriber listening on room:*:ai_stream');
  return subscriber;
}

module.exports = { setupRedisAdapter, setupAIStreamSubscriber };
