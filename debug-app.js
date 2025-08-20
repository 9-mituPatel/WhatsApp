import express from 'express';
import { createServer } from 'http';
import config from "./src/config/config.js";
import { connectDB } from './src/config/db.js';
import { initializeRedis } from './src/config/redis.js';
import logger from './src/utils/logger.js';

console.log('🚀 Starting debug app...');

/**
 * Initialize the application
 */
async function initializeApp() {
  try {
    console.log('🔧 Initializing database connections...');
    
    // Initialize database connections
    await connectDB();
    logger.info('✅ MongoDB connected successfully');
    
    console.log('✅ MongoDB connection completed');
    
    // Initialize Redis (optional)
    try {
      await initializeRedis();
      logger.info('✅ Redis connected successfully');
      console.log('✅ Redis connection completed');
    } catch (error) {
      logger.warn('⚠️ Redis connection failed, continuing without cache:', error.message);
      console.log('⚠️ Redis failed, continuing...');
    }
    
    console.log('✅ All connections initialized');
    return true;
  } catch (error) {
    logger.error('💥 Application initialization failed:', error);
    console.error('💥 Init failed:', error);
    process.exit(1);
  }
}

console.log('📡 Calling initializeApp...');
await initializeApp();
console.log('🎯 App initialization completed');

const app = express();
const httpServer = createServer(app);

console.log('🔧 Setting up basic middleware...');

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

console.log('🛣️ Setting up routes...');

// Basic health route
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
    environment: config.env
  });
});

console.log('🚀 Starting server...');

// Start Server
const PORT = config.port || 3200;
httpServer.listen(PORT, () => {
  console.log(`✅ Debug Server running on port ${PORT}`);
  logger.info(`🚀 Debug Server running on port ${PORT}`);
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  logger.error('💥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});
