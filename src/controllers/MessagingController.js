import WhatsAppService from '../services/WhatsAppService.js';
import logger from '../utils/logger.js';

class MessagingController {
    // Send a text message
    async sendMessage(req, res) {
        try {
            logger.info('Send message request received', { sessionId: req.body?.sessionId, to: req.body?.to });
            
            const { sessionId, to, message } = req.body;
            
            if (!sessionId || !to || !message) {
                logger.warn('Send message request missing required fields');
                return res.status(400).json({
                    success: false,
                    message: "sessionId, to, and message are required"
                });
            }

            // Format phone number (add @s.whatsapp.net if not present)
            const formattedTo = to.includes('@') ? to : `${to}@s.whatsapp.net`;
            
            logger.info(`Sending message from ${sessionId} to ${formattedTo}`);
            
            const result = await WhatsAppService.sendTestMessage(sessionId, formattedTo, message);
            
            logger.info('Message sent successfully', { sessionId, to: formattedTo, messageId: result.key?.id });
            
            return res.status(200).json({
                success: true,
                message: "Message sent successfully",
                data: {
                    sessionId,
                    to: formattedTo,
                    messageId: result.key?.id,
                    timestamp: result.messageTimestamp
                }
            });
        } catch (error) {
            logger.error('Send message error:', error);
            
            return res.status(500).json({
                success: false,
                message: "Failed to send message",
                error: error.message
            });
        }
    }

    // Get session information
    async getSessionInfo(req, res) {
        try {
            const { sessionId } = req.params;
            
            logger.info(`Getting session info for: ${sessionId}`);
            
            const sessionInfo = await WhatsAppService.getSessionInfo(sessionId);
            
            if (!sessionInfo) {
                logger.warn(`Session not found: ${sessionId}`);
                return res.status(404).json({
                    success: false,
                    message: "Session not found or not connected"
                });
            }

            logger.info(`Session info retrieved for: ${sessionId}`, { status: sessionInfo.status });
            
            return res.status(200).json({
                success: true,
                message: "Session info retrieved",
                data: sessionInfo
            });
        } catch (error) {
            logger.error('Get session info error:', error);
            
            return res.status(500).json({
                success: false,
                message: "Failed to get session info",
                error: error.message
            });
        }
    }

    // Get all active sessions
    async getAllSessions(req, res) {
        try {
            logger.info('Getting all active sessions');
            
            const sessions = await WhatsAppService.getAllActiveSessions();
            
            logger.info(`Found ${sessions.length} active sessions`);
            
            return res.status(200).json({
                success: true,
                message: `Found ${sessions.length} active sessions`,
                data: {
                    count: sessions.length,
                    sessions: sessions
                }
            });
        } catch (error) {
            logger.error('Get all sessions error:', error);
            
            return res.status(500).json({
                success: false,
                message: "Failed to get sessions",
                error: error.message
            });
        }
    }

    // Send message to multiple recipients
    async broadcastMessage(req, res) {
        try {
            logger.info('Broadcast message request received', { sessionId: req.body?.sessionId, recipientCount: req.body?.recipients?.length });
            
            const { sessionId, recipients, message } = req.body;
            
            if (!sessionId || !recipients || !message || !Array.isArray(recipients)) {
                logger.warn('Broadcast message request missing required fields or invalid recipients array');
                return res.status(400).json({
                    success: false,
                    message: "sessionId, recipients (array), and message are required"
                });
            }

            logger.info(`Broadcasting message from ${sessionId} to ${recipients.length} recipients`);
            
            const results = [];
            const errors = [];

            for (const recipient of recipients) {
                try {
                    const formattedRecipient = recipient.includes('@') ? recipient : `${recipient}@s.whatsapp.net`;
                    const result = await WhatsAppService.sendTestMessage(sessionId, formattedRecipient, message);
                    
                    results.push({
                        to: formattedRecipient,
                        success: true,
                        messageId: result.key?.id
                    });
                    
                    logger.info(`Message sent to ${formattedRecipient}`, { messageId: result.key?.id });
                    
                    // Add delay between messages to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    errors.push({
                        to: recipient,
                        success: false,
                        error: error.message
                    });
                    logger.warn(`Failed to send to ${recipient}`, { error: error.message });
                }
            }
            
            logger.info(`Broadcast completed: ${results.length} success, ${errors.length} errors`, { 
                successCount: results.length, 
                errorCount: errors.length, 
                totalRecipients: recipients.length 
            });
            
            return res.status(200).json({
                success: true,
                message: `Broadcast completed: ${results.length}/${recipients.length} messages sent`,
                data: {
                    sessionId,
                    totalRecipients: recipients.length,
                    successCount: results.length,
                    errorCount: errors.length,
                    results: results,
                    errors: errors
                }
            });
        } catch (error) {
            logger.error('Broadcast message error:', error);
            
            return res.status(500).json({
                success: false,
                message: "Failed to broadcast message",
                error: error.message
            });
        }
    }
}

export default new MessagingController();
