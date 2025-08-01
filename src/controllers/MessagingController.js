import WhatsAppService from '../services/WhatsAppService.js';
import logger from '../utils/logger.js';

class MessagingController {
    // Send a text message
    async sendMessage(req, res) {
        try {
            console.log('\n📤 ===== SEND MESSAGE REQUEST =====');
            console.log('📝 Request Body:', req.body);
            
            const { sessionId, to, message } = req.body;
            
            if (!sessionId || !to || !message) {
                console.log('❌ Missing required fields');
                return res.status(400).json({
                    success: false,
                    message: "sessionId, to, and message are required"
                });
            }

            // Format phone number (add @s.whatsapp.net if not present)
            const formattedTo = to.includes('@') ? to : `${to}@s.whatsapp.net`;
            
            console.log(`📤 Sending message from ${sessionId} to ${formattedTo}`);
            
            const result = await WhatsAppService.sendTestMessage(sessionId, formattedTo, message);
            
            console.log('✅ Message sent successfully');
            console.log('📊 Result:', result);
            
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
            console.log('💥 ERROR in sendMessage:', error);
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
            console.log('\n📊 ===== GET SESSION INFO REQUEST =====');
            const { sessionId } = req.params;
            
            console.log(`📋 Getting info for session: ${sessionId}`);
            
            const sessionInfo = await WhatsAppService.getSessionInfo(sessionId);
            
            if (!sessionInfo) {
                console.log('❌ Session not found');
                return res.status(404).json({
                    success: false,
                    message: "Session not found or not connected"
                });
            }

            console.log('✅ Session info retrieved');
            console.log('📊 Session Info:', sessionInfo);
            
            return res.status(200).json({
                success: true,
                message: "Session info retrieved",
                data: sessionInfo
            });
        } catch (error) {
            console.log('💥 ERROR in getSessionInfo:', error);
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
            console.log('\n📋 ===== GET ALL SESSIONS REQUEST =====');
            
            const sessions = await WhatsAppService.getAllActiveSessions();
            
            console.log(`✅ Found ${sessions.length} active sessions`);
            
            return res.status(200).json({
                success: true,
                message: `Found ${sessions.length} active sessions`,
                data: {
                    count: sessions.length,
                    sessions: sessions
                }
            });
        } catch (error) {
            console.log('💥 ERROR in getAllSessions:', error);
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
            console.log('\n📢 ===== BROADCAST MESSAGE REQUEST =====');
            console.log('📝 Request Body:', req.body);
            
            const { sessionId, recipients, message } = req.body;
            
            if (!sessionId || !recipients || !message || !Array.isArray(recipients)) {
                console.log('❌ Missing required fields or invalid recipients array');
                return res.status(400).json({
                    success: false,
                    message: "sessionId, recipients (array), and message are required"
                });
            }

            console.log(`📢 Broadcasting message from ${sessionId} to ${recipients.length} recipients`);
            
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
                    
                    console.log(`✅ Message sent to ${formattedRecipient}`);
                    
                    // Add delay between messages to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    errors.push({
                        to: recipient,
                        success: false,
                        error: error.message
                    });
                    console.log(`❌ Failed to send to ${recipient}:`, error.message);
                }
            }
            
            console.log(`📊 Broadcast completed: ${results.length} success, ${errors.length} errors`);
            
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
            console.log('💥 ERROR in broadcastMessage:', error);
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
