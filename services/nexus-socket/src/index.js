/**
 * nexus-socket — Real-time Socket.IO service
 *
 * Responsibilities:
 * - WebSocket connections with Firebase authentication
 * - Room management (join/leave chats)
 * - Message broadcasting via Redis adapter (horizontal scaling)
 * - AI stream relay (Redis PubSub → Socket.IO rooms)
 * - Presence & typing indicators
 * - Message persistence to PostgreSQL
 * - AI inference triggering via Google Cloud Pub/Sub
 */

const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const config = require('./config');
const { jwtAuthMiddleware } = require('./auth');
const { setupRedisAdapter, setupAIStreamSubscriber } = require('./redis');
const { registerRoomHandlers } = require('./handlers/rooms');
const { registerPresenceHandlers } = require('./handlers/presence');
const { registerMessagingHandlers, initPubSub } = require('./handlers/messaging');

async function main() {
  console.log('='.repeat(50));
  console.log('nexus-socket service starting...');
  console.log('='.repeat(50));

  let pgPool;
  let redisClient;

  // ---- HTTP Server (for health checks + Socket.IO upgrade) ----
  const httpServer = http.createServer(async (req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy', service: 'nexus-socket' }));
      return;
    }
    if (req.url === '/ready') {
      try {
        // Check Postgres
        if (!pgPool) throw new Error('Postgres pool not initialized');
        const client = await pgPool.connect();
        client.release();

        // Check Redis
        if (!redisClient || !redisClient.isReady) throw new Error('Redis not connected');
        await redisClient.ping();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ready', service: 'nexus-socket' }));
      } catch (err) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'unready', service: 'nexus-socket', error: err.message }));
      }
      return;
    }
    res.writeHead(404);
    res.end('Not Found');
  });

  // ---- Socket.IO Server ----
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => callback(null, true),
      methods: ['GET', 'POST'],
      credentials: true,
    },

    // Increase max buffer size for large messages
    maxHttpBufferSize: 1e6, // 1 MB
    // Ping/pong for connection keepalive
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // ---- JWT Auth ----
  io.use(jwtAuthMiddleware);

  // ---- Start Server Immediately so Cloud Run Healthcheck Passes in <50ms ----
  httpServer.listen(config.PORT, () => {
    console.log('='.repeat(50));
    console.log(`nexus-socket listening on port ${config.PORT}`);
    console.log(`  Health:  http://localhost:${config.PORT}/health`);
    console.log(`  Ready:   http://localhost:${config.PORT}/ready`);
    console.log('='.repeat(50));
  });

  // ---- Redis Adapter (horizontal scaling) ----
  try {
    const clients = await setupRedisAdapter(io);
    if (clients) redisClient = clients.pubClient;
  } catch (err) {
    console.warn('[startup] Redis adapter warning:', err.message);
  }

  // ---- AI Stream Subscriber (Redis PubSub → Socket.IO) ----
  try {
    await setupAIStreamSubscriber(io);
  } catch (err) {
    console.warn('[startup] AI stream subscriber warning:', err.message);
  }

  // ---- PostgreSQL Pool ----
  pgPool = new Pool({ connectionString: config.DATABASE_URL });
  pgPool.on('error', (err) => console.error('[postgres] Pool error:', err.message));

  try {
    const client = await pgPool.connect();
    console.log('[postgres] Connected successfully');
    
    // Ensure reaction and thread tables exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS message_reactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        user_email VARCHAR(255) NOT NULL,
        emoji VARCHAR(32) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_user_message_emoji UNIQUE (message_id, user_email, emoji)
      );
      CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON message_reactions(message_id);

      CREATE TABLE IF NOT EXISTS thread_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        parent_message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        chat_id UUID NOT NULL,
        group_id UUID NOT NULL,
        user_id UUID NOT NULL,
        user_email VARCHAR(255) NOT NULL,
        user_name VARCHAR(255),
        user_avatar VARCHAR(512),
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_thread_parent_id ON thread_messages(parent_message_id);

      ALTER TABLE messages ADD COLUMN IF NOT EXISTS thread_count INTEGER DEFAULT 0;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS thread_last_reply_at TIMESTAMPTZ;
    `);
    console.log('[postgres] Schema verified (reactions & threads ready)');
    client.release();
  } catch (err) {
    console.warn('[startup] Postgres connection/init warning:', err.message);
  }

  // ---- Pub/Sub (AI inference trigger) ----
  try {
    await initPubSub();
  } catch (err) {
    console.warn('[startup] PubSub init warning:', err.message);
  }

  // ---- Connection Handler ----
  io.on('connection', (socket) => {
    const user = socket.data.user;
    console.log(`[socket] Connected: ${user?.email} (${socket.id})`);

    // Register all event handlers
    registerRoomHandlers(socket, io);
    registerPresenceHandlers(socket, io);
    registerMessagingHandlers(socket, io, pgPool);

    socket.on('disconnect', (reason) => {
      console.log(`[socket] Disconnected: ${user?.email} (${reason})`);
    });
  });


  // ---- Graceful Shutdown ----
  const shutdown = async (signal) => {
    console.log(`\n[shutdown] Received ${signal}, shutting down gracefully...`);

    // Close Socket.IO (disconnects all clients)
    io.close(() => console.log('[shutdown] Socket.IO closed'));

    // Close HTTP server
    httpServer.close(() => console.log('[shutdown] HTTP server closed'));

    // Close Postgres pool
    await pgPool.end().catch(() => { });
    console.log('[shutdown] Postgres pool closed');

    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
