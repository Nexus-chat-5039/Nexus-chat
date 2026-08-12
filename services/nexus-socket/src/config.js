/**
 * Configuration for nexus-socket service.
 * All values loaded from environment variables with sensible defaults.
 */

require('dotenv').config();

const isProd = process.env.ENV === 'production';

function getEnvOrFallback(key, fallback) {
  const v = process.env[key];
  if (!v) {
    if (isProd && fallback === undefined) {
      console.error(`Missing required environment variable in production: ${key}`);
      process.exit(1);
    }
    return fallback;
  }
  return v;
}

module.exports = {
  // Server
  PORT: parseInt(process.env.PORT || '3001', 10),

  // Redis — used for Socket.IO adapter + AI stream subscription
  REDIS_URL: getEnvOrFallback('REDIS_URL', 'redis://localhost:6379'),

  // PostgreSQL — for message persistence
  DATABASE_URL: getEnvOrFallback('DATABASE_URL', 'postgres://root:rootpassword@localhost:5432/nexus'),

  // Firebase — for WebSocket authentication
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',

  // Redis Streams — for publishing async AI inference and embed tasks
  REDIS_STREAM_AI: process.env.REDIS_STREAM_AI || 'stream:ai.inference',
  REDIS_STREAM_EMBED: process.env.REDIS_STREAM_EMBED || 'stream:embed.messages',

  // PubSub Config
  GCP_PROJECT_ID: getEnvOrFallback('GCP_PROJECT_ID', 'nexus-local'),
  PUBSUB_TOPIC_AI_INFERENCE: getEnvOrFallback('PUBSUB_TOPIC_AI_INFERENCE', 'ai.inference'),
  PUBSUB_TOPIC_EMBED: getEnvOrFallback('PUBSUB_TOPIC_EMBED', 'embed.messages'),

  // CORS
  CORS_ORIGIN: getEnvOrFallback('CORS_ORIGIN', 'http://localhost:5173'),
};
