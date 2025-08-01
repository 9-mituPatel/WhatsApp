import express from 'express';
import MessagingController from '../controllers/MessagingController.js';

const router = express.Router();

// Send a single message
router.post('/send', MessagingController.sendMessage);

// Get session information
router.get('/session/:sessionId', MessagingController.getSessionInfo);

// Get all active sessions
router.get('/sessions', MessagingController.getAllSessions);

// Broadcast message to multiple recipients
router.post('/broadcast', MessagingController.broadcastMessage);

export default router;
