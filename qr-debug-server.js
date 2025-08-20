import express from 'express';
import { createServer } from 'http';
import qrcode from 'qrcode';

console.log('🚀 Starting QR Debug Server (Standalone)...');

const app = express();
const httpServer = createServer(app);

console.log('🔧 Setting up middleware...');

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
    version: '1.0.0-standalone',
    uptime: process.uptime(),
    environment: 'debug'
  });
});

// QR login route with real QR code generation
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
      status: 'qr_generated', // Show as waiting for QR scan
      lastActivity: new Date().toISOString(),
      createdAt: new Date(Date.now() - 60000).toISOString(), // 1 min ago
      isConnected: false,
      message: 'Waiting for QR code scan'
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
      status: 'qr_generated',
      isConnected: false,
      message: 'QR code generated, waiting for scan'
    }
  });
});

// Generic API health endpoint
app.get('/api/health', (req, res) => {
  console.log('🔍 API health check');
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'WhatsApp QR Debug Server',
    version: '1.0.0-standalone'
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
      'GET /api/health'
    ]
  });
});

console.log('🚀 Starting server...');

// Start Server
const PORT = 3200;
httpServer.listen(PORT, () => {
  console.log(`✅ QR Debug Server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 QR Login: http://localhost:${PORT}/api/auth/QRlogin`);
  
  // Log every 30 seconds to show it's still alive
  setInterval(() => {
    console.log(`💓 Server still alive after ${Math.floor(process.uptime())} seconds`);
  }, 30000);
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('🎯 QR Debug Server setup complete!');
