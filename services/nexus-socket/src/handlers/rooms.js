/**
 * Room management handlers.
 * Handles joining/leaving Socket.IO rooms mapped to Nexus chats.
 */

/**
 * Registers room handlers on a connected socket.
 */
function registerRoomHandlers(socket, io) {
  /**
   * join_chat — Client joins a chat room.
   * Payload: { chatId: string, groupId: string }
   */
  socket.on('join_chat', ({ chatId, groupId }) => {
    if (!chatId) {
      socket.emit('error_event', { message: 'chatId is required' });
      return;
    }

    const room = `chat:${chatId}`;
    socket.join(room);

    console.log(`[rooms] ${socket.data.user?.email} joined ${room}`);

    // Notify others in the room
    socket.to(room).emit('user_joined', {
      userId: socket.data.user?.uid,
      name: socket.data.user?.name,
      chatId,
    });
  });

  /**
   * leave_chat — Client leaves a chat room.
   * Payload: { chatId: string }
   */
  socket.on('leave_chat', ({ chatId }) => {
    if (!chatId) return;

    const room = `chat:${chatId}`;
    socket.leave(room);

    console.log(`[rooms] ${socket.data.user?.email} left ${room}`);

    socket.to(room).emit('user_left', {
      userId: socket.data.user?.uid,
      name: socket.data.user?.name,
      chatId,
    });
  });

  /**
   * On disconnect, Socket.IO automatically removes the socket from all rooms.
   * We just log it here.
   */
  socket.on('disconnecting', () => {
    const rooms = [...socket.rooms].filter((r) => r !== socket.id);
    if (rooms.length > 0) {
      console.log(`[rooms] ${socket.data.user?.email} disconnecting from rooms: ${rooms.join(', ')}`);
    }
  });
}

module.exports = { registerRoomHandlers };
