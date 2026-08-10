/**
 * Configuration for nexus-socket service.
 * All values loaded from environment variables with sensible defaults.
 */

require('dotenv').config();

module.exports = {
  // Server
  PORT: parseInt(process.env.PORT || '3001', 10),

  // Redis — used for Socket.IO adapter + AI stream subscription
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // PostgreSQL — for message persistence
  DATABASE_URL: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/nexus',

  // Firebase — for WebSocket authentication
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',

  // Redis Streams — for publishing async AI inference and embed tasks
  REDIS_STREAM_AI: process.env.REDIS_STREAM_AI || 'stream:ai.inference',
  REDIS_STREAM_EMBED: process.env.REDIS_STREAM_EMBED || 'stream:embed.messages',

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
};
