/**
 * Presence and typing indicator handlers.
 * Broadcasts user online/offline status and typing events to rooms.
 */

// In-memory presence tracker (per-pod).
// Cross-pod presence is handled by the Redis adapter broadcasting events.
const onlineUsers = new Map(); // socketId → { uid, name, email }

/**
 * Registers presence handlers on a connected socket.
 */
function registerPresenceHandlers(socket, io) {
  const user = socket.data.user;

  // Track this user as online
  if (user) {
    onlineUsers.set(socket.id, {
      uid: user.uid,
      name: user.name,
      email: user.email,
    });
  }

  /**
   * typing_start — User started typing in a chat.
   * Payload: { chatId: string }
   */
  socket.on('typing_start', ({ chatId }) => {
    if (!chatId) return;

    socket.to(`chat:${chatId}`).emit('typing_indicator', {
      userId: user?.uid,
      name: user?.name,
      chatId,
      isTyping: true,
    });
  });

  /**
   * typing_stop — User stopped typing.
   * Payload: { chatId: string }
   */
  socket.on('typing_stop', ({ chatId }) => {
    if (!chatId) return;

    socket.to(`chat:${chatId}`).emit('typing_indicator', {
      userId: user?.uid,
      name: user?.name,
      chatId,
      isTyping: false,
    });
  });

  /**
   * get_online_users — Request list of online users (this pod only).
   * For full cross-pod presence, use Redis sets in production.
   */
  socket.on('get_online_users', (callback) => {
    if (typeof callback === 'function') {
      const users = [...onlineUsers.values()];
      callback(users);
    }
  });

  /**
   * On disconnect, remove from presence tracker.
   */
  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    console.log(`[presence] ${user?.email} went offline (${onlineUsers.size} users on this pod)`);
  });
}

module.exports = { registerPresenceHandlers };
