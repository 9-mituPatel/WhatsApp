import express from 'express';
import { createServer } from 'http';
import config from "./src/config/config.js";

console.log('🔍 Starting test server...');

const app = express();
const httpServer = createServer(app);

console.log('📝 Setting up basic middleware...');

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

console.log('🔧 Setting up basic routes...');

// Test route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
    environment: config.env
  });
});

// Test QR login endpoint
app.post('/api/auth/QRlogin', (req, res) => {
  console.log('📨 QR Login request received:', req.body);
  res.json({
    success: true,
    message: 'Test endpoint working',
    data: {
      sessionId: req.body.sessionId,
      status: 'test'
    }
  });
});

console.log('🚀 Starting server...');

// Start Server
const PORT = config.port || 3200;
httpServer.listen(PORT, () => {
  console.log(`✅ Test Server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔗 QR Login: http://localhost:${PORT}/api/auth/QRlogin`);
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});
