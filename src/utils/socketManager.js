// Socket.IO manager to avoid circular imports
let io = null;

export const setIO = (socketInstance) => {
  io = socketInstance;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized!');
  }
  return io;
};

export const emitToSession = (sessionId, event, data) => {
  if (io) {
    io.to(sessionId).emit(event, data);
  }
};

export const emitGlobal = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};
