import express from 'express';
import { createServer } from 'http';
import config from "./src/config/config.js";
import { connectDB } from './src/config/db.js';
import { initializeRedis } from './src/config/redis.js';
import logger from './src/utils/logger.js';
import qrcode from 'qrcode';

console.log('🚀 Starting debug app (NO SIGINT handler)...');

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

// CORS middleware - MUST be before other middleware
app.use((req, res, next) => {
  // Allow requests from common frontend development ports
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001', 
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://localhost:5173', // Vite default
    'http://localhost:4200', // Angular default
    'http://localhost:8080'  // Vue CLI default
  ];
  
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log('🔧 CORS preflight request from:', origin);
    res.sendStatus(200);
    return;
  }
  
  console.log(`📡 ${req.method} ${req.path} from origin: ${origin || 'none'}`);
  next();
});

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

// QR login test route
app.post('/api/auth/QRlogin', async (req, res) => {
  try {
    console.log('📨 QR Login request received:', req.body);
    const sessionId = req.body.sessionId || 'debug-session';
    
    // Generate a realistic test QR code data (simulating WhatsApp QR format)
    const testQRData = `1@${Math.random().toString(36).substring(2, 15)},${Math.random().toString(36).substring(2, 15)},${Date.now()},3,demo`;
    
    console.log('📱 Generating QR code for session:', sessionId);
    
    // Generate actual QR code using qrcode library
    const qrCodeDataURL = await qrcode.toDataURL(testQRData, {
      errorCorrectionLevel: 'L',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    });
    
    console.log('✅ QR Code generated successfully for session:', sessionId);
    
    // Also display QR in terminal for debugging
    qrcode.toString(testQRData, { type: 'terminal', small: true }, (err, url) => {
      if (!err) {
        console.log('\n📱 Scan this QR code with your WhatsApp mobile app:');
        console.log(url);
        console.log('\n1. Open WhatsApp on your phone');
        console.log('2. Tap Settings → Linked Devices');
        console.log('3. Tap "Link Device"');
        console.log('4. Scan the QR code above\n');
      }
    });
    
    res.json({
      success: true,
      message: 'QR Code generated successfully (Debug Mode)',
      data: {
        sessionId: sessionId,
        status: 'qr_generated',
        qrCode: qrCodeDataURL,
        instructions: {
          step1: 'Open WhatsApp on your phone',
          step2: 'Go to Settings → Linked Devices',
          step3: 'Tap "Link Device"',
          step4: 'Scan the QR code displayed above'
        },
        note: 'This is a demo QR code - it won\'t actually connect to WhatsApp'
      }
    });
  } catch (error) {
    console.error('💥 Error generating QR code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate QR code',
      error: error.message
    });
  }
});

// Session status endpoint
app.get('/api/auth/session-status/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  console.log('📋 Session status request for:', sessionId);
  
  res.json({
    success: true,
    data: {
      sessionId: sessionId,
      status: 'authenticated', // or 'pending', 'disconnected', 'error'
      lastActivity: new Date().toISOString(),
      createdAt: new Date(Date.now() - 60000).toISOString(), // 1 min ago
      isConnected: true,
      phoneNumber: '+1234567890',
      deviceName: 'Debug Device'
    }
  });
});

// Check auth status endpoint
app.get('/api/auth/status/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  console.log('🔍 Auth status check for:', sessionId);
  
  res.json({
    success: true,
    data: {
      sessionId: sessionId,
      status: 'authenticated',
      isConnected: true,
      message: 'Session is active'
    }
  });
});

// Logout endpoint
app.post('/api/auth/logout/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  console.log('🚪 Logout request for:', sessionId);
  
  res.json({
    success: true,
    message: 'Session logged out successfully',
    data: {
      sessionId: sessionId,
      status: 'disconnected'
    }
  });
});

// Send message endpoint
app.post('/api/messaging/send', (req, res) => {
  console.log('💬 Send message request:', req.body);
  
  res.json({
    success: true,
    message: 'Message sent successfully (debug)',
    data: {
      messageId: 'debug_msg_' + Date.now(),
      sessionId: req.body.sessionId,
      to: req.body.to,
      message: req.body.message,
      timestamp: new Date().toISOString(),
      status: 'sent'
    }
  });
});

// Get chats endpoint
app.get('/api/messaging/chats/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  console.log('💬 Get chats request for:', sessionId);
  
  res.json({
    success: true,
    data: {
      chats: [
        {
          id: 'debug_chat_1',
          name: 'Debug Contact 1',
          phoneNumber: '+1234567890',
          lastMessage: 'Hello from debug server',
          timestamp: new Date().toISOString(),
          unreadCount: 0
        },
        {
          id: 'debug_chat_2', 
          name: 'Debug Contact 2',
          phoneNumber: '+0987654321',
          lastMessage: 'This is a test message',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          unreadCount: 2
        }
      ]
    }
  });
});

// Get messages for a chat
app.get('/api/messaging/messages/:sessionId/:chatId', (req, res) => {
  const { sessionId, chatId } = req.params;
  console.log(`💬 Get messages for chat ${chatId} in session ${sessionId}`);
  
  res.json({
    success: true,
    data: {
      messages: [
        {
          id: 'msg_1',
          chatId: chatId,
          from: '+1234567890',
          to: '+0987654321',
          content: { text: 'Hello! This is a debug message.' },
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          fromMe: false,
          messageType: 'text'
        },
        {
          id: 'msg_2',
          chatId: chatId,
          from: '+0987654321',
          to: '+1234567890',
          content: { text: 'Thanks for testing the debug server!' },
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          fromMe: true,
          messageType: 'text'
        }
      ]
    }
  });
});

// Generic API health endpoint
app.get('/api/health', (req, res) => {
  console.log('🔍 API health check');
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'WhatsApp API Debug Server',
    version: '1.0.0-debug'
  });
});

// Catch-all for missing API endpoints
app.use('/api/*', (req, res) => {
  console.log(`❓ Unknown API endpoint: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    message: `API endpoint ${req.method} ${req.path} not found in debug server`,
    availableEndpoints: [
      'POST /api/auth/QRlogin',
      'GET /api/auth/session-status/:sessionId',
      'GET /api/auth/status/:sessionId',
      'POST /api/auth/logout/:sessionId',
      'POST /api/messaging/send',
      'GET /api/messaging/chats/:sessionId',
      'GET /api/messaging/messages/:sessionId/:chatId',
      'GET /api/health'
    ]
  });
});

console.log('🚀 Starting server...');

// Start Server
const PORT = config.port || 3200;
httpServer.listen(PORT, () => {
  console.log(`✅ Debug Server running on port ${PORT}`);
  logger.info(`🚀 Debug Server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 QR Login: http://localhost:${PORT}/api/auth/QRlogin`);
  
  // Log every 10 seconds to show it's still alive
  setInterval(() => {
    console.log(`💓 Server still alive after ${Math.floor(process.uptime())} seconds`);
  }, 10000);
});

// Modified error handling - do NOT handle SIGINT to test
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  logger.error('💥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Log signal handlers being called
process.on('SIGINT', () => {
  console.log('📡 SIGINT received - but ignoring it for testing!');
});

process.on('SIGTERM', () => {
  console.log('📡 SIGTERM received - but ignoring it for testing!');
});

console.log('🎯 All setup complete, server should be running...');
