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

  // GCP Pub/Sub — for publishing AI inference requests
  GCP_PROJECT_ID: process.env.GCP_PROJECT_ID || 'nexus-local',
  PUBSUB_TOPIC_AI_INFERENCE: process.env.PUBSUB_TOPIC_AI_INFERENCE || 'ai.inference',
  PUBSUB_TOPIC_EMBED: process.env.PUBSUB_TOPIC_EMBED || 'embed.messages',

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
};
