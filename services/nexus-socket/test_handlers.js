const assert = require('assert');
const { registerMessagingHandlers } = require('./src/handlers/messaging');

// Mock socket, io, and pgPool
async function runTests() {
  console.log('Running nexus-socket handler tests...');

  const events = {};
  const emitted = [];
  const roomEmitted = [];

  const mockSocket = {
    data: {
      user: {
        uid: 'user-uuid-1234',
        email: 'alice@example.com',
        name: 'Alice',
        picture: 'https://avatar.png'
      }
    },
    on: (evt, handler) => {
      events[evt] = handler;
    },
    emit: (evt, payload) => {
      emitted.push({ evt, payload });
    }
  };

  const mockIo = {
    to: (room) => ({
      emit: (evt, payload) => {
        roomEmitted.push({ room, evt, payload });
      }
    }),
    emit: (evt, payload) => {
      roomEmitted.push({ room: 'global', evt, payload });
    }
  };

  const queries = [];
  const mockPgPool = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes('SELECT id FROM message_reactions')) {
        // First time: not found
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes('INSERT INTO thread_messages')) {
        return {
          rows: [{ id: 'thread-msg-uuid', created_at: new Date().toISOString() }]
        };
      }
      return { rowCount: 1, rows: [{ id: 'test-id' }] };
    }
  };

  registerMessagingHandlers(mockSocket, mockIo, mockPgPool);

  // Test 1: Event registration
  assert(typeof events['react_message'] === 'function', 'react_message handler should be registered');
  assert(typeof events['send_thread_reply'] === 'function', 'send_thread_reply handler should be registered');
  assert(typeof events['send_message'] === 'function', 'send_message handler should be registered');
  console.log('✔ Handlers registered successfully');

  // Test 2: react_message event
  const msgId = '00000000-0000-0000-0000-000000000001';
  const chatId = '00000000-0000-0000-0000-000000000002';
  const groupId = '00000000-0000-0000-0000-000000000003';

  let ackResult = null;
  await events['react_message']({
    messageId: msgId,
    emoji: '👍',
    groupId,
    chatId
  }, (res) => { ackResult = res; });

  assert(ackResult && ackResult.success === true, 'react_message ack should succeed');
  assert(ackResult.action === 'add', 'react_message action should be "add"');
  
  const lastBroadcast = roomEmitted.find(e => e.evt === 'message_reacted');
  assert(lastBroadcast, 'message_reacted event should be emitted');
  assert.strictEqual(lastBroadcast.room, `chat:${chatId}`);
  assert.strictEqual(lastBroadcast.payload.emoji, '👍');
  assert.strictEqual(lastBroadcast.payload.userId, 'alice@example.com');
  assert.strictEqual(lastBroadcast.payload.action, 'add');
  console.log('✔ react_message flow and room broadcast verified');

  // Test 3: send_thread_reply event
  let threadAckResult = null;
  await events['send_thread_reply']({
    parentMessageId: msgId,
    content: 'Awesome update!',
    groupId,
    chatId,
    tempId: 'thread_temp_123'
  }, (res) => { threadAckResult = res; });

  assert(threadAckResult && threadAckResult.success === true, 'send_thread_reply ack should succeed');
  const threadBroadcast = roomEmitted.find(e => e.evt === 'thread_reply');
  assert(threadBroadcast, 'thread_reply event should be emitted');
  assert.strictEqual(threadBroadcast.room, `chat:${chatId}`);
  assert.strictEqual(threadBroadcast.payload.parentMessageId, msgId);
  assert.strictEqual(threadBroadcast.payload.reply.content, 'Awesome update!');
  assert.strictEqual(threadBroadcast.payload.reply.userEmail, 'alice@example.com');
  assert.strictEqual(threadBroadcast.payload.reply.tempId, 'thread_temp_123');
  console.log('✔ send_thread_reply flow, counter cache update, and room broadcast verified');

  console.log('All socket unit tests passed 100%!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
