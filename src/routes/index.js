import express  from 'express';
import authRoute from './authroute.js';
import messagingRoute from './messagingRoute.js';
import WhatsAppController from '../controllers/WhatsAppController.js';

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'WhatsApp API Server'
  });
});

// Primary auth routes using controller
router.post('/auth/QRlogin', WhatsAppController.qrLogin);
router.get('/auth/status/:sessionId', WhatsAppController.checkStatus);
router.get('/auth/session-status/:sessionId', WhatsAppController.checkStatus);
router.post('/auth/logout/:sessionId', WhatsAppController.logout);

const defaultRoutes = [
  {
    path: '/messaging',
    route: messagingRoute,
  },
  {
    path: '/auth-direct',  // Secondary route for direct access
    route: authRoute,
  }
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;

