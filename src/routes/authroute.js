import express from 'express';
import { makeWASocket, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

const router = express.Router();

// Create Baileys-compatible logger
const baileysLogger = {
  level: 'silent', // Set to 'silent' to reduce noise, or 'debug' for more info
  fatal: (...args) => logger.error(...args),
  error: (...args) => logger.error(...args),
  warn: (...args) => logger.warn(...args),
  info: (...args) => logger.info(...args),
  debug: (...args) => logger.debug(...args),
  trace: (...args) => logger.debug(...args), // Map trace to debug
  child: () => baileysLogger // Return the same logger for child loggers
};

// Store active WhatsApp connections
const activeConnections = new Map();

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

        // Create WhatsApp socket connection
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: baileysLogger,
            browser: ['WhatsApp Bot', 'Chrome', '1.0.0'],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 0,
            keepAliveIntervalMs: 10000,
            emitOwnEvents: true,
            fireInitQueries: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            markOnlineOnConnect: true,
        });

        let qrCodeData = null;
        let isConnected = false;
        let connectionStatus = 'connecting';

        // Handle QR code generation
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                try {
                    // Generate QR code as base64 data URL
                    qrCodeData = await qrcode.toDataURL(qr);
                    connectionStatus = 'qr_generated';
                    // Log QR code as ASCII
                    qrcode.toString(qr, { type: 'terminal',small: true  }, (err, url) => {
                        if (err) {
                            logger.error('Error displaying QR code:', err);
                        } else {
                            console.log(url); // Display ASCII QR Code in terminal
                        }
                    });
                    logger.info(`QR Code generated for session: ${sessionId}`);
                } catch (error) {
                    logger.error('Error generating QR code:', error);
                }
            }
            
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    logger.info(`Connection closed for session ${sessionId}, reconnecting...`);
                    connectionStatus = 'reconnecting';
                } else {
                    logger.info(`Session ${sessionId} logged out`);
                    connectionStatus = 'logged_out';
                    activeConnections.delete(sessionId);
                }
            } else if (connection === 'open') {
                logger.info(`WhatsApp connection opened for session: ${sessionId}`);
                isConnected = true;
                connectionStatus = 'connected';
                activeConnections.set(sessionId, sock);
            }
        });

        // Save credentials when updated
        sock.ev.on('creds.update', saveCreds);

        // Wait for QR code generation or connection
        const timeout = setTimeout(() => {
            if (!isConnected && !qrCodeData) {
                sock.end(undefined);
            }
        }, 30000); // 30 seconds timeout

        // Wait for either QR code or connection
        await new Promise((resolve) => {
            const checkStatus = setInterval(() => {
                if (qrCodeData || isConnected) {
                    clearInterval(checkStatus);
                    clearTimeout(timeout);
                    resolve(true);
                }
            }, 1000);
        });

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
                message: "Connection timeout"
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
