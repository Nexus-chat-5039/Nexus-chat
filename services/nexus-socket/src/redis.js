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
  if (!config.REDIS_URL || (process.env.ENV === 'production' && (config.REDIS_URL.includes('localhost') || config.REDIS_URL.includes('127.0.0.1')))) {
    console.log('[redis] No external REDIS_URL provided — running with in-memory Socket.IO adapter');
    return null;
  }

  const clientOptions = {
    url: config.REDIS_URL,
    socket: {
      connectTimeout: 3000,
      reconnectStrategy: (retries) => {
        if (retries > 3) return false;
        return 1000;
      },
    },
  };

  const pubClient = createClient(clientOptions);
  const subClient = pubClient.duplicate();

  pubClient.on('error', (err) => console.warn('[redis-adapter] Pub client warning:', err.message));
  subClient.on('error', (err) => console.warn('[redis-adapter] Sub client warning:', err.message));

  await Promise.race([
    Promise.all([pubClient.connect(), subClient.connect()]),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Redis connection timeout')), 3000)),
  ]);

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
  if (!config.REDIS_URL || (process.env.ENV === 'production' && (config.REDIS_URL.includes('localhost') || config.REDIS_URL.includes('127.0.0.1')))) {
    return null;
  }

  const subscriber = createClient({
    url: config.REDIS_URL,
    socket: {
      connectTimeout: 3000,
      reconnectStrategy: (retries) => {
        if (retries > 3) return false;
        return 1000;
      },
    },
  });

  subscriber.on('error', (err) => console.warn('[redis-ai-stream] Warning:', err.message));

  await Promise.race([
    subscriber.connect(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Redis AI subscriber timeout')), 3000)),
  ]);


  // Use pattern subscribe to catch all chat rooms
  await subscriber.pSubscribe('room:*:ai_stream', (message, channel) => {
    try {
      const chunk = JSON.parse(message);

      // Extract chatId from channel: "room:{chatId}:ai_stream"
      const parts = channel.split(':');
      const chatId = parts.slice(1, -1).join(':'); // Handle UUIDs with colons

      // Emit only to local clients in the Socket.IO room for this chat
      // (prevents double-emission through the @socket.io/redis-adapter)
      io.local.to(`chat:${chatId}`).emit('ai_stream_chunk', {
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
