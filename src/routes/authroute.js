import express from 'express';
import { makeWASocket, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import qrcode from 'qrcode';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import { emitToSession } from '../utils/socketManager.js';

const router = express.Router();


// Enhanced Baileys logger with detailed error tracking
const baileysLogger = {
  level: 'silent',
  fatal: (...args) => {
    const errorStr = args.join(' ');
    logger.error('Baileys Fatal:', errorStr);
  },
  error: (...args) => {
    const errorStr = args.join(' ');
    // Only log significant errors
    if (!errorStr.includes('stream-error') && 
        !errorStr.includes('connection-close') && 
        !errorStr.includes('ECONNRESET') &&
        !errorStr.includes('socket hang up') &&
        !errorStr.includes('ENOTFOUND') &&
        !errorStr.includes('timeout')) {
      logger.warn('Baileys Error:', errorStr);
    }
  },
  warn: () => {},
  info: () => {},
  debug: () => {},
  trace: () => {},
  child: () => baileysLogger
};

// Store active WhatsApp connections and their status
const activeConnections = new Map();
const sessionStatus = new Map();
const qrTimers = new Map(); // Store QR refresh timers

// WhatsApp QR Login endpoint
router.post("/QRlogin", async (req, res) => {
    try {
        const { sessionId } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: "Session ID is required"
            });
        }

        // Create session directory
        const sessionPath = path.join(process.cwd(), 'sessions', sessionId);
        if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
        }

        // Use multi-file auth state
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        // Create WhatsApp socket connection with optimized settings
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: baileysLogger,
            browser: ['WhatsApp Business', 'Chrome', '4.0.0'],
            connectTimeoutMs: 90000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 25000,
            emitOwnEvents: true,
            fireInitQueries: true,
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            retryRequestDelayMs: 3000,
            maxMsgRetryCount: 2,
            // Additional stability options
            shouldIgnoreJid: jid => jid?.endsWith('@broadcast'),
            shouldSyncHistoryMessage: msg => {
                return !!msg.message && !msg.key.remoteJid?.endsWith('@g.us');
            },
            transactionOpts: {
                maxCommitRetries: 3,
                delayBetweenTriesMs: 2000
            },
            qrTimeout: 60000,
            getMessage: async (key) => {
                // Return empty message to avoid errors
                return { conversation: 'Message not found' };
            }
        });

        let qrCodeData = null;
        let isConnected = false;
        let connectionStatus = 'connecting';

        // Handle QR code generation with enhanced debugging
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr, isNewLogin } = update;
            
            logger.info(`Connection update for ${sessionId}: ${connection}`, {
                connection,
                hasQR: !!qr,
                isNewLogin
            });
            
            if (qr) {
                try {
                    // Generate QR code as base64 data URL
                    qrCodeData = await qrcode.toDataURL(qr);
                    connectionStatus = 'qr_generated';
                    sessionStatus.set(sessionId, connectionStatus);
                    
                    logger.info(`QR code generated successfully for session: ${sessionId}`);
                    
                    // Emit QR code to frontend via Socket.IO
                    emitToSession(sessionId, 'qr-code', {
                        sessionId,
                        qrCode: qrCodeData,
                        status: connectionStatus
                    });
                    
                } catch (error) {
                    logger.error(`Failed to generate QR code for ${sessionId}:`, error);
                }
            }
            
            // Handle different connection states
            if (connection === 'connecting') {
                logger.info(`Connecting to WhatsApp for session: ${sessionId}`);
                connectionStatus = 'connecting';
                sessionStatus.set(sessionId, connectionStatus);
                
                emitToSession(sessionId, 'status-update', {
                    sessionId,
                    status: connectionStatus,
                    message: 'Connecting to WhatsApp...'
                });
            } else if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                logger.info(`Connection closed for session ${sessionId}, status code: ${statusCode}`);
                
                if (shouldReconnect && statusCode !== DisconnectReason.connectionClosed) {
                    logger.info(`Connection closed for session ${sessionId}, reconnecting...`);
                    connectionStatus = 'reconnecting';
                    sessionStatus.set(sessionId, connectionStatus);
                    
                    // Emit reconnecting status
                    emitToSession(sessionId, 'status-update', {
                        sessionId,
                        status: connectionStatus,
                        message: 'Reconnecting to WhatsApp...'
                    });
                } else {
                    logger.info(`Session ${sessionId} logged out or closed permanently`);
                    connectionStatus = 'logged_out';
                    activeConnections.delete(sessionId);
                    sessionStatus.delete(sessionId);
                    
                    // Clear any timers
                    const timer = qrTimers.get(sessionId);
                    if (timer) {
                        clearInterval(timer);
                        qrTimers.delete(sessionId);
                    }
                    
                    // Emit logged out status
                    emitToSession(sessionId, 'status-update', {
                        sessionId,
                        status: connectionStatus,
                        message: 'Session logged out'
                    });
                }
            } else if (connection === 'open') {
                logger.info(`🎉 WhatsApp connection opened for session: ${sessionId}`);
                isConnected = true;
                connectionStatus = 'connected';
                sessionStatus.set(sessionId, connectionStatus);
                activeConnections.set(sessionId, sock);
                
                // Send presence update
                try {
                    await sock.sendPresenceUpdate('available');
                    await saveCreds();
                } catch (error) {
                    logger.error('Error updating presence:', error);
                }
                
                // Emit connected status
                emitToSession(sessionId, 'status-update', {
                    sessionId,
                    status: connectionStatus,
                    message: 'Successfully connected to WhatsApp!',
                    user: sock.user
                });
                
                logger.info(`✅ Session ${sessionId} is now connected and ready!`);
            }
        });

        // Track incoming messages
        sock.ev.on('messages.upsert', async (messageUpdate) => {
          const { messages } = messageUpdate;
          for (const msg of messages) {
            const content = msg.message?.conversation || 'Media message';
            logger.info(`New message: ${content}`);
          }
        });

        // Save credentials when updated
        sock.ev.on('creds.update', saveCreds);

        // Wait for QR code generation with shorter timeout
        const timeout = setTimeout(() => {
            if (!isConnected && !qrCodeData) {
                logger.warn(`QR generation timeout for session: ${sessionId}`);
                sock.end(undefined);
            }
        }, 15000); // 15 seconds timeout for QR generation

        // Wait for QR code generation (not connection)
        await new Promise((resolve) => {
            const checkQR = setInterval(() => {
                if (qrCodeData || isConnected) {
                    clearInterval(checkQR);
                    clearTimeout(timeout);
                    resolve(true);
                }
            }, 500);
        });

        // Store the socket for this session
        activeConnections.set(sessionId, sock);

        // Set up automatic QR refresh every 5 minutes if not connected
        if (!isConnected && qrCodeData) {
            const refreshTimer = setInterval(() => {
                const currentConnection = activeConnections.get(sessionId);
                const currentStatus = sessionStatus.get(sessionId);
                
                // Only refresh if still not connected
                if (currentConnection && currentStatus !== 'connected') {
                    logger.info(`🔄 Auto-refreshing QR code for session: ${sessionId}`);
                    
                    // Restart the connection to generate new QR
                    currentConnection.end(undefined);
                    
                    // Remove from active connections temporarily
                    activeConnections.delete(sessionId);
                    
                    // Emit refresh signal to frontend
                    emitToSession(sessionId, 'qr-refresh', {
                        sessionId,
                        message: 'QR Code expired. Generating new one...'
                    });
                    
                    // Trigger new QR generation by calling the same endpoint
                    setTimeout(() => {
                        emitToSession(sessionId, 'qr-auto-refresh', { sessionId });
                    }, 1000);
                } else {
                    // Clear timer if connected
                    clearInterval(refreshTimer);
                    qrTimers.delete(sessionId);
                }
            }, 5 * 60 * 1000); // 5 minutes
            
            qrTimers.set(sessionId, refreshTimer);
        }

        if (isConnected) {
            return res.status(200).json({
                success: true,
                message: "WhatsApp connected successfully",
                data: {
                    sessionId,
                    status: connectionStatus,
                    user: sock.user
                }
            });
        } else if (qrCodeData) {
            return res.status(200).json({
                success: true,
                message: "QR Code generated successfully",
                data: {
                    sessionId,
                    qrCode: qrCodeData,
                    status: connectionStatus
                }
            });
        } else {
            return res.status(408).json({
                success: false,
                message: "QR generation timeout"
            });
        }

    } catch (error) {
        logger.error('WhatsApp QR Login Error:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
});

// Check connection status endpoint
router.get("/status/:sessionId", (req, res) => {
    try {
        const { sessionId } = req.params;
        const connection = activeConnections.get(sessionId);
        
        if (connection) {
            return res.status(200).json({
                success: true,
                message: "Session is active",
                data: {
                    sessionId,
                    status: 'connected',
                    user: connection.user
                }
            });
        } else {
            return res.status(404).json({
                success: false,
                message: "Session not found or inactive"
            });
        }
    } catch (error) {
        logger.error('Status check error:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
});

// Manual QR refresh endpoint
router.post("/refresh-qr/:sessionId", async (req, res) => {
    try {
        const { sessionId } = req.params;
        const connection = activeConnections.get(sessionId);
        const status = sessionStatus.get(sessionId);
        
        if (!connection || status === 'connected') {
            return res.status(400).json({
                success: false,
                message: status === 'connected' ? "Already connected" : "Session not found"
            });
        }

        logger.info(`🔄 Manual QR refresh requested for session: ${sessionId}`);
        
        // End current connection
        connection.end(undefined);
        activeConnections.delete(sessionId);
        
        // Clear existing timer
        const existingTimer = qrTimers.get(sessionId);
        if (existingTimer) {
            clearInterval(existingTimer);
            qrTimers.delete(sessionId);
        }
        
        // Emit refresh signal
        emitToSession(sessionId, 'qr-manual-refresh', {
            sessionId,
            message: 'Generating new QR code...'
        });
        
        return res.status(200).json({
            success: true,
            message: "QR code refresh initiated"
        });
        
    } catch (error) {
        logger.error('QR refresh error:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
});

// Logout endpoint
router.post("/logout/:sessionId", async (req, res) => {
    try {
        const { sessionId } = req.params;
        const connection = activeConnections.get(sessionId);
        
        if (connection) {
            await connection.logout();
            activeConnections.delete(sessionId);
            
            // Clean up session files
            const sessionPath = path.join(process.cwd(), 'sessions', sessionId);
            if (fs.existsSync(sessionPath)) {
                fs.rmSync(sessionPath, { recursive: true, force: true });
            }
            
            return res.status(200).json({
                success: true,
                message: "Logged out successfully"
            });
        } else {
            return res.status(404).json({
                success: false,
                message: "Session not found"
            });
        }
    } catch (error) {
        logger.error('Logout error:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
});

export default router;
