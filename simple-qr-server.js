import http from 'http';
import url from 'url';
import qrcode from 'qrcode';

console.log('🚀 Starting Simple QR Server...');

// Store active QR sessions with auto-refresh
const qrSessions = new Map();

// QR code refresh interval (5 seconds for fast testing)
const QR_REFRESH_INTERVAL = 5000;

function generateQRData() {
  // Generate proper WhatsApp Web QR format
  // Format: ref,publicKey,privateKey,serverToken,browserToken,clientToken,wid,ttl
  const ref = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const publicKey = Buffer.from(Array.from({length: 32}, () => Math.floor(Math.random() * 256))).toString('base64');
  const privateKey = Buffer.from(Array.from({length: 32}, () => Math.floor(Math.random() * 256))).toString('base64');
  const serverToken = Buffer.from(Array.from({length: 20}, () => Math.floor(Math.random() * 256))).toString('base64');
  const browserToken = Buffer.from(Array.from({length: 20}, () => Math.floor(Math.random() * 256))).toString('base64');
  const clientToken = Buffer.from(Array.from({length: 20}, () => Math.floor(Math.random() * 256))).toString('base64');
  const ttl = Math.floor(Date.now() / 1000) + 300; // 5 minutes from now
  
  // This is still a demo format that will be recognized by WhatsApp but won't actually connect
  // For real WhatsApp connection, you need actual Baileys integration
  return `${ref},${publicKey},${privateKey},${serverToken},${browserToken},${clientToken},,${ttl}`;
}

async function createQRCodeSession(sessionId) {
  console.log('🔄 Creating new QR session for:', sessionId);
  
  const qrData = generateQRData();
  const qrCodeDataURL = await qrcode.toDataURL(qrData, {
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
  
  const session = {
    sessionId,
    qrCode: qrCodeDataURL,
    qrData,
    createdAt: new Date(),
    refreshCount: 1
  };
  
  qrSessions.set(sessionId, session);
  
  // Set up auto-refresh for this session
  const refreshTimer = setInterval(async () => {
    try {
      const currentSession = qrSessions.get(sessionId);
      if (!currentSession) {
        clearInterval(refreshTimer);
        return;
      }
      
      console.log(`🔄 Auto-refreshing QR code for session: ${sessionId} (refresh #${currentSession.refreshCount + 1})`);
      
      const newQrData = generateQRData();
      const newQrCodeDataURL = await qrcode.toDataURL(newQrData, {
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
      
      currentSession.qrCode = newQrCodeDataURL;
      currentSession.qrData = newQrData;
      currentSession.lastRefresh = new Date();
      currentSession.refreshCount++;
      
      // Display new QR in terminal
      qrcode.toString(newQrData, { type: 'terminal', small: true }, (err, url) => {
        if (!err) {
          console.log(`\n🔄 QR Code refreshed for ${sessionId} (refresh #${currentSession.refreshCount}):`);
          console.log(url);
          console.log('');
        }
      });
      
    } catch (error) {
      console.error('💥 Error refreshing QR code:', error);
    }
  }, QR_REFRESH_INTERVAL);
  
  // Clean up after 5 minutes of inactivity
  setTimeout(() => {
    console.log(`🧹 Cleaning up QR session: ${sessionId}`);
    clearInterval(refreshTimer);
    qrSessions.delete(sessionId);
  }, 300000); // 5 minutes
  
  return session;
}

const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  const parsedUrl = url.parse(req.url, true);
  const method = req.method;
  const pathname = parsedUrl.pathname;
  
  console.log(`📡 ${method} ${pathname}`);
  
  // Handle OPTIONS preflight
  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Handle QR login endpoint
  if (method === 'POST' && pathname === '/api/auth/QRlogin') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const sessionId = data.sessionId || 'debug-session';
        
        console.log('📨 QR Login request for session:', sessionId);
        
        // Create or get existing QR session with auto-refresh
        const session = await createQRCodeSession(sessionId);
        
        console.log('✅ QR Code session created with auto-refresh!');
        
        const response = {
          success: true,
          message: 'QR Code generated successfully with auto-refresh (Debug Mode)',
          data: {
            sessionId: sessionId,
            status: 'qr_generated',
            qrCode: session.qrCode,
            refreshInterval: QR_REFRESH_INTERVAL,
            refreshCount: session.refreshCount,
            createdAt: session.createdAt.toISOString(),
            instructions: {
              step1: 'Open WhatsApp on your phone',
              step2: 'Go to Settings → Linked Devices',
              step3: 'Tap "Link Device"',
              step4: 'Scan the QR code displayed above'
            },
            note: 'This QR code will refresh automatically every 5 seconds for fast testing (Demo Mode)'
          }
        };
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
        
        // Also display QR in terminal
        qrcode.toString(session.qrData, { type: 'terminal', small: true }, (err, url) => {
          if (!err) {
            console.log('\n📱 Initial QR Code for session:', sessionId);
            console.log(url);
            console.log('🔄 QR will auto-refresh every 5 seconds\n');
          }
        });
        
      } catch (error) {
        console.error('💥 Error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          message: 'Failed to generate QR code',
          error: error.message
        }));
      }
    });
    return;
  }
  
  // Handle get current QR code endpoint (for auto-refresh)
  if (method === 'GET' && pathname.startsWith('/api/auth/qr/')) {
    const sessionId = pathname.split('/').pop();
    console.log('🔄 QR refresh request for:', sessionId);
    
    const session = qrSessions.get(sessionId);
    if (session) {
      const response = {
        success: true,
        data: {
          sessionId: sessionId,
          status: 'qr_generated',
          qrCode: session.qrCode,
          refreshCount: session.refreshCount,
          lastRefresh: session.lastRefresh?.toISOString() || session.createdAt.toISOString(),
          nextRefreshIn: QR_REFRESH_INTERVAL - (Date.now() - (session.lastRefresh || session.createdAt).getTime())
        }
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'QR session not found or expired'
      }));
    }
    return;
  }
  
  // Handle session status endpoint
  if (method === 'GET' && pathname.startsWith('/api/auth/session-status/')) {
    const sessionId = pathname.split('/').pop();
    console.log('📋 Session status request for:', sessionId);
    
    const session = qrSessions.get(sessionId);
    const response = {
      success: true,
      data: {
        sessionId: sessionId,
        status: session ? 'qr_generated' : 'expired',
        lastActivity: new Date().toISOString(),
        createdAt: session ? session.createdAt.toISOString() : new Date(Date.now() - 60000).toISOString(),
        isConnected: false,
        refreshCount: session ? session.refreshCount : 0,
        message: session ? 'QR code active, auto-refreshing every 5s' : 'Session expired or not found'
      }
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
    return;
  }
  
  // Handle health check
  if (method === 'GET' && pathname === '/health') {
    const response = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Simple QR Server'
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
    return;
  }
  
  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    success: false,
    message: 'Endpoint not found'
  }));
});

const PORT = 3200;
server.listen(PORT, () => {
  console.log(`✅ Simple QR Server running on http://localhost:${PORT}`);
  console.log(`🔗 QR Login: http://localhost:${PORT}/api/auth/QRlogin`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
});

server.on('error', (error) => {
  console.error('💥 Server error:', error);
});
