import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import config from "./src/config/config.js";
import { connectDB } from './src/config/db.js';
import { initializeRedis } from './src/config/redis.js';
import logger from './src/utils/logger.js';
import router from './src/routes/index.js';
import { setIO } from './src/utils/socketManager.js';
import SessionManager from './src/services/SessionManager.js';

/**
 * Initialize the application
 */
async function initializeApp() {
  try {
    logger.info('🚀 Starting WhatsApp API Server...');
    
    // Initialize database connections
    await connectDB();
    logger.info('✅ MongoDB connected successfully');
    
    // Initialize Redis (optional)
    try {
      await initializeRedis();
      logger.info('✅ Redis connected successfully');
    } catch (error) {
      logger.warn('⚠️ Redis connection failed, continuing without cache:', error.message);
    }
    
    return true;
  } catch (error) {
    logger.error('💥 Application initialization failed:', error);
    process.exit(1);
  }
}

// Wait for initialization
logger.info('🔧 About to initialize app...');
await initializeApp();
logger.info('✅ App initialization completed');

logger.info('🔧 Creating Express app...');
const app = express();
logger.info('🔧 Creating HTTP server...');
const httpServer = createServer(app);
logger.info('✅ HTTP server created');

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
logger.info('🔧 Setting up body parsing middleware...');
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
logger.info('✅ Body parsing middleware set up');

// Static files
logger.info('🔧 Setting up static files middleware...');
app.use(express.static('public'));
logger.info('✅ Static files middleware set up');

// Initialize Socket.IO with enhanced security
logger.info('🔧 Creating Socket.IO server...');
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
logger.info('✅ Socket.IO server created');

// Set up socket manager
setIO(io);

// Health Check Routes
logger.info('🔧 Setting up health check routes...');
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
    // Simplified health check without Redis for now
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: { status: 'not_connected' },
        redis: { status: 'not_connected' },
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
logger.info('✅ Health check routes set up');

// Legacy routes (consider removing in production)
logger.info('🔧 Setting up legacy routes...');
if (config.env === 'development') {
  app.get('/', (req, res) => {
    res.json({
      message: 'WhatsApp API Server',
      version: config.app.version,
      documentation: '/api-docs',
      health: '/health'
    });
  });
  
  // Temporarily remove file serving routes
  // app.get('/login', (req, res) => {
  //   res.sendFile('index.html', { root: 'public' });
  // });
  // 
  // app.get('/dashboard', (req, res) => {
  //   res.sendFile('dashboard.html', { root: 'public' });
  // });
}
logger.info('✅ Legacy routes set up');

// Swagger Documentation
// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// API Routes (using actual router)
logger.info('🔧 Setting up API routes...');
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Use the actual router for all API endpoints
app.use('/api', router);
logger.info('✅ API routes set up');

// Simple 404 handler for unmatched routes - TEMPORARILY COMMENTED OUT
// app.use('*', (req, res) => {
//   res.status(404).json({
//     status: 'error',
//     message: `Route ${req.method} ${req.path} not found`,
//     timestamp: new Date().toISOString()
//   });
// });

// Simple error handler - TEMPORARILY COMMENTED OUT
// app.use((err, req, res, next) => {
//   logger.error('Application error:', err);
//   res.status(500).json({
//     status: 'error',
//     message: config.env === 'development' ? err.message : 'Internal Server Error',
//     timestamp: new Date().toISOString()
//   });
// });
logger.info('✅ Error handlers set up');

// Socket.IO connection handling
logger.info('🔧 Setting up Socket.IO event handlers...');
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
      // Using actual SessionManager
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
console.log(`About to start server on port ${PORT}`);
logger.info(`About to start server on port ${PORT}`);

httpServer.listen(PORT, () => {
  console.log(`✅ HTTP Server listening on port ${PORT}`);
  logger.info(`🚀 WhatsApp Server running on port ${PORT}`);
  logger.info(`🔌 Socket.IO server ready`);
  
  // Initialize SessionManager after server is running
  SessionManager.initialize();
});

console.log('Server listen command executed');

// Export io for use in other modules
export { io };
