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
      origin: config.CORS_ORIGIN,
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

  // ---- Redis Adapter (horizontal scaling) ----
  try {
    const clients = await setupRedisAdapter(io);
    redisClient = clients.pubClient;
  } catch (err) {
    console.warn('[startup] Redis adapter failed — running without horizontal scaling:', err.message);
  }

  // ---- AI Stream Subscriber (Redis PubSub → Socket.IO) ----
  try {
    await setupAIStreamSubscriber(io);
  } catch (err) {
    console.warn('[startup] AI stream subscriber failed:', err.message);
  }

  // ---- PostgreSQL Pool ----
  pgPool = new Pool({ connectionString: config.DATABASE_URL });
  pgPool.on('error', (err) => console.error('[postgres] Pool error:', err.message));

  try {
    const client = await pgPool.connect();
    client.release();
    console.log('[postgres] Connected successfully');
  } catch (err) {
    console.warn('[startup] Postgres connection failed — message persistence disabled:', err.message);
  }

  // ---- Pub/Sub (AI inference trigger) ----
  await initPubSub();

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

  // ---- Start Server ----
  httpServer.listen(config.PORT, () => {
    console.log('='.repeat(50));
    console.log(`nexus-socket listening on port ${config.PORT}`);
    console.log(`  Health:  http://localhost:${config.PORT}/health`);
    console.log(`  Ready:   http://localhost:${config.PORT}/ready`);
    console.log('='.repeat(50));
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
