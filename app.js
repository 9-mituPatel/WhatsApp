import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import config from "./src/config/config.js";
import { connectDB } from './src/config/db.js';
import { initializeRedis } from './src/config/redis.js';
import logger from './src/utils/logger.js';
import router from './src/routes/index.js';
import { setIO } from './src/utils/socketManager.js';
// Temporarily disabled to identify startup issues
// import SecurityMiddleware from './src/middlewares/security.js';
// import ErrorHandler from './src/middlewares/errorHandler.js';
// import { specs, swaggerUi } from './swagger/index.js';

/**
 * Initialize the application
 */
async function initializeApp() {
  try {
    // Initialize database connections
    await connectDB();
    logger.info('✅ MongoDB connected successfully');
    
    // Initialize Redis (optional)
    try {
      await initializeRedis();
      logger.info('✅ Redis connected successfully');
    } catch (error) {
      logger.warn('⚠️ Redis connection failed, continuing without cache:', error.message);
      // Continue without Redis - the application should still work
    }
    
    return true;
  } catch (error) {
    logger.error('💥 Application initialization failed:', error);
    process.exit(1);
  }
}

// Wait for initialization
await initializeApp();

const app = express();
const httpServer = createServer(app);

// Apply basic security middlewares (temporarily simplified for startup)
// TODO: Uncomment after all packages are installed
// app.use(...SecurityMiddleware.getAllMiddlewares());

// Basic CORS for development
if (config.env === 'development') {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static('public'));

// Initialize Socket.IO with enhanced security
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001'
      ];
      
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Set up socket manager
setIO(io);

// Health Check Routes
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: config.app.version,
    uptime: process.uptime(),
    environment: config.env
  });
});

app.get('/health/detailed', async (req, res) => {
  try {
    const { redisManager } = await import('./src/config/redis.js');
    const redisHealth = await redisManager.healthCheck();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: { status: 'connected' },
        redis: redisHealth,
        memory: {
          usage: process.memoryUsage(),
          heap: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2) + ' MB'
        }
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'degraded',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Legacy routes (consider removing in production)
if (config.env === 'development') {
  app.get('/', (req, res) => {
    res.json({
      message: 'WhatsApp API Server',
      version: config.app.version,
      documentation: '/api-docs',
      health: '/health'
    });
  });
  
  app.get('/login', (req, res) => {
    res.sendFile('index.html', { root: 'public' });
  });
  
  app.get('/dashboard', (req, res) => {
    res.sendFile('dashboard.html', { root: 'public' });
  });
}

// Swagger Documentation
// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// API Routes
app.use('/api', router);

// Simple 404 handler for unmatched routes
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString()
  });
});

// Simple error handler
app.use((err, req, res, next) => {
  logger.error('Application error:', err);
  res.status(500).json({
    status: 'error',
    message: config.env === 'development' ? err.message : 'Internal Server Error',
    timestamp: new Date().toISOString()
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
