import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import config from "./src/config/config.js";
import cors from 'cors';
import { connectDB } from './src/config/db.js';
import logger from './src/utils/logger.js';
import router from './src/routes/index.js';
import { setIO } from './src/utils/socketManager.js';
// import { specs, swaggerUi } from './swagger/index.js';

// Connect to MongoDB
await connectDB();

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Set up socket manager
setIO(io);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health Check Route
app.get('/', (req, res) => {
  logger.info('User visited root route');
  res.send(' Congratulations! Your server is running!');
});

// Login page route
app.get('/login', (req, res) => {
  logger.info('User visited login page');
  res.sendFile('index.html', { root: 'public' });
});

// Dashboard page route
app.get('/dashboard', (req, res) => {
  logger.info('User visited dashboard page');
  res.sendFile('dashboard.html', { root: 'public' });
});

// Test route
app.get('/log', (req, res) => {
  logger.info('Test log endpoint called');
  logger.warn('This is a test warning');
  logger.error('This is a test error');
  res.json({ message: 'Test logs generated', timestamp: new Date().toISOString() });
});

// Swagger Documentation
// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// API Routes
app.use('/api', router);

// Error Handler (Optional)
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({
    message: 'Internal Server Error',
    error: err.message,
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`🔌 Socket connected: ${socket.id}`);
  
  socket.on('join-session', (sessionId) => {
    socket.join(sessionId);
    logger.info(`📱 Socket ${socket.id} joined session: ${sessionId}`);
  });
  
  // Handle authentication monitoring requests from frontend
  socket.on('monitor-session', (sessionId) => {
    socket.join(sessionId);
    logger.info(`👀 Socket ${socket.id} monitoring session: ${sessionId}`);
    
    // Send immediate status update
    socket.emit('auth-status', {
      sessionId: sessionId,
      status: 'monitoring',
      message: 'Monitoring session for authentication updates'
    });
  });
  
  // Handle session status requests
  socket.on('get-session-status', async (sessionId) => {
    try {
      // Import here to avoid circular dependency
      const { default: SessionManager } = await import('./src/services/SessionManager.js');
      const sessionData = SessionManager.getSession(sessionId);
      
      if (sessionData) {
        socket.emit('session-status', {
          sessionId: sessionId,
          status: sessionData.status,
          lastActivity: sessionData.lastActivity,
          createdAt: sessionData.createdAt
        });
      } else {
        socket.emit('session-status', {
          sessionId: sessionId,
          status: 'not_found',
          message: 'Session not found'
        });
      }
    } catch (error) {
      logger.error('Error getting session status:', error);
      socket.emit('session-status', {
        sessionId: sessionId,
        status: 'error',
        message: 'Error retrieving session status'
      });
    }
  });
  
  socket.on('disconnect', () => {
    logger.info(`🔌 Socket disconnected: ${socket.id}`);
  });
});

// Start Server
const PORT = config.port || 3000;
httpServer.listen(PORT, () => {
  logger.info(`🚀 WhatsApp Server running on port ${PORT}`);
  logger.info(`🔌 Socket.IO server ready`);
});

// Export io for use in other modules
export { io };
