import WhatsAppService from '../services/WhatsAppService.js';
import logger from '../utils/logger.js';

class WhatsAppController {
    async qrLogin(req, res) {
        try {
            const { sessionId } = req.body;
            
            if (!sessionId) {
                return res.status(400).json({
                    success: false,
                    message: "Session ID is required",
                });
            }

            const result = await WhatsAppService.createSession(sessionId);
            
            let response;
            
            if (result.status === 'connected' && result.alreadyConnected) {
                // Session is already connected
                response = {
                    success: true,
                    message: "Already connected to WhatsApp",
                    data: {
                        sessionId,
                        status: 'connected',
                        user: result.user,
                        alreadyConnected: true
                    }
                };
            } else if (result.status === 'connected' && result.autoReconnected) {
                // Session auto-reconnected
                response = {
                    success: true,
                    message: "Auto-reconnected to WhatsApp",
                    data: {
                        sessionId,
                        status: 'connected',
                        user: result.user,
                        autoReconnected: true
                    }
                };
            } else {
                // QR code generated or other status
                response = {
                    success: true,
                    message: result.qrCode ? "QR Code generated successfully" : result.message || "Session created",
                    data: {
                        sessionId,
                        ...result
                    }
                };
            }
            
            return res.status(200).json(response);
        } catch (error) {
            logger.error('WhatsApp QR Login Error:', error);
            
            const errorResponse = {
                success: false,
                message: "Internal server error",
                error: error.message,
            };
            
            return res.status(500).json(errorResponse);
        }
    }

    async checkStatus(req, res) {
        try {
            const { sessionId } = req.params;
            const session = await WhatsAppService.getConnectionStatus(sessionId);

            if (session) {
                return res.status(200).json({
                    success: true,
                    message: "Session is active",
                    data: {
                        sessionId,
                        status: session.status || 'connected',
                        user: session.user || null
                    }
                });
            } else {
                return res.status(404).json({
                    success: false,
                    message: "Session not found or inactive",
                });
            }
        } catch (error) {
            logger.error('Status check error:', error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }

    async logout(req, res) {
        try {
            const { sessionId } = req.params;
            await WhatsAppService.logoutSession(sessionId);
            
            return res.status(200).json({
                success: true,
                message: "Logged out successfully",
            });
        } catch (error) {
            logger.error('Logout error:', error);
            return res.status(500).json({
                success: false,
                message: "Internal server error",
            });
        }
    }
}

export default new WhatsAppController();
