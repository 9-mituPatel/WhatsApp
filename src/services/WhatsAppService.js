import { makeWASocket, DisconnectReason, useMultiFileAuthState, isJidBroadcast } from '@whiskeysockets/baileys';
import qrcode from 'qrcode';
import fs from 'fs';
import path from 'path';
import WhatsAppSessionDAO from '../dao/WhatsAppSessionDAO.js';
import MessageDAO from '../dao/MessageDAO.js';
import SessionManager from './SessionManager.js';
import { emitToSession } from '../utils/socketManager.js';
import logger from '../utils/logger.js';

// Create optimized Baileys logger with error filtering
const baileysLogger = {
  level: 'silent', // Suppress most Baileys logs
  fatal: (...args) => {
    const errorStr = args.join(' ');
    logger.error('Baileys Fatal:', errorStr);
  },
  error: (...args) => {
    const errorStr = args.join(' ');
    // Filter out common non-critical errors
    if (!errorStr.includes('stream-error') && 
        !errorStr.includes('connection-close') &&
        !errorStr.includes('ECONNRESET') &&
        !errorStr.includes('socket hang up') &&
        !errorStr.includes('ENOTFOUND') &&
        !errorStr.includes('timeout')) {
      logger.warn('Baileys Error:', errorStr);
    }
  },
  warn: () => {}, // Suppress warnings
  info: () => {}, // Suppress info messages  
  debug: () => {}, // Suppress debug messages
  trace: () => {}, // Suppress trace messages
  child: () => baileysLogger
};

class WhatsAppService {
  constructor() {
    this.activeConnections = new Map();
  }

  async createSession(sessionId) {
    try {
      // Check if session already exists and is connected
      const existingSession = this.activeConnections.get(sessionId);
      if (existingSession && existingSession.user) {
        logger.info(`Session ${sessionId} already connected, returning existing connection`);
        const userData = {
          id: existingSession.user?.id,
          name: existingSession.user?.name,
          phone: existingSession.user?.id?.split(':')[0]
        };
        
        // Return existing connected session info
        return {
          status: 'connected',
          message: 'Already connected to WhatsApp',
          user: userData,
          alreadyConnected: true
        };
      }
      
      // Check if there's an existing session directory with valid auth
      const sessionPath = path.join(process.cwd(), 'sessions', sessionId);
      const credsPath = path.join(sessionPath, 'creds.json');
      
      if (fs.existsSync(credsPath)) {
        try {
          const credsData = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
          if (credsData && credsData.me && credsData.me.id) {
            logger.info(`Found existing credentials for ${sessionId}, attempting auto-reconnect...`);
            
            // Try to reconnect with existing credentials
            const reconnectResult = await this.attemptReconnection(sessionId);
            if (reconnectResult) {
              return reconnectResult;
            }
          }
        } catch (error) {
          logger.warn(`Failed to read existing credentials for ${sessionId}:`, error.message);
        }
      }
      
      // If we have an existing session but it's not connected, clean it up
      if (existingSession) {
        logger.warn(`Session ${sessionId} exists but not connected, terminating old session`);
        await this.logoutSession(sessionId);
      }

      // Create session directory if it doesn't exist
      if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
        logger.info(`Created session directory: ${sessionPath}`);
      }
      if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
        logger.info(`Created session directory: ${sessionPath}`);
      }

      // Use multi-file auth state
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
      logger.info(`Auth state loaded for session: ${sessionId}`);

      // Create WhatsApp socket connection with better configuration
      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: baileysLogger,
        browser: ['WhatsApp Web', 'Chrome', '1.0.0'], // Changed browser name
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000, // Increased timeout
        keepAliveIntervalMs: 10000,
        emitOwnEvents: true,
        fireInitQueries: true,
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        markOnlineOnConnect: true,
        // Add these important options
        shouldSyncHistoryMessage: msg => {
          return !!msg.message && !msg.key.remoteJid?.endsWith('@g.us');
        },
        // shouldIgnoreJid: jid => isJidBroadcast(jid),
        linkPreviewImageThumbnailWidth: 192,
        transactionOpts: {
          maxCommitRetries: 5,
          delayBetweenTriesMs: 3000
        }
      });

      // Add session to manager
      await SessionManager.addSession(sessionId, sock);

      // Save credentials when updated
      sock.ev.on('creds.update', async () => {
        try {
          await saveCreds();
          logger.debug(`Credentials updated for session: ${sessionId}`);
        } catch (error) {
          logger.error(`Error saving credentials for ${sessionId}:`, error);
        }
      });

      // Store session data in database
      const sessionData = {
        sessionId,
        sessionPath,
        status: 'connecting'
      };
      await WhatsAppSessionDAO.createSession(sessionData);
      logger.info(`Session ${sessionId} created in database`);

      return this.waitForQRCodeOrConnection(sock, sessionId);
    } catch (error) {
      logger.error(`Error creating session ${sessionId}:`, error);
      // Clean up on error
      await SessionManager.removeSession(sessionId, 'error');
      throw error;
    }
  }

  async waitForQRCodeOrConnection(sock, sessionId) {
    return new Promise((resolve, reject) => {
      let qrCodeData = null;
      let isConnected = false;
      let isPaired = false;
      let connectionStatus = 'connecting';

      const timeout = setTimeout(() => {
        if (!isConnected && !qrCodeData && !isPaired) {
          logger.warn(`Connection timeout for session ${sessionId}`);
          sock.end(undefined);
          reject(new Error('Connection timeout'));
        }
      }, 45000); // Increased timeout

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr, isNewLogin } = update;
        
        logger.info(`Connection update for ${sessionId}: ${connection}`, {
          isNewLogin,
          hasQR: !!qr
        });
        
        if (qr) {
          try {
            qrCodeData = await qrcode.toDataURL(qr);
            connectionStatus = 'qr_generated';
            
            // QR code generated successfully
            
            logger.info(`📱 QR Code generated for session: ${sessionId}`);
            await SessionManager.updateSessionStatus(sessionId, 'qr_generated', { qrCode: qrCodeData });
            
            clearTimeout(timeout);
            resolve({ 
              qrCode: qrCodeData, 
              status: connectionStatus,
              instructions: {
                step1: 'Open WhatsApp on your phone',
                step2: 'Go to Settings → Linked Devices',
                step3: 'Tap "Link Device"',
                step4: 'Scan the QR code'
              }
            });
          } catch (error) {
            logger.error('Error generating QR code:', error);
            reject(error);
          }
        }
        
        // Handle different connection states
        if (connection === 'connecting') {
          logger.info(`🔄 Connecting WhatsApp for session: ${sessionId}`);
          connectionStatus = 'connecting';
          await SessionManager.updateSessionStatus(sessionId, 'connecting');
          
          // Notify frontend via WebSocket
          try {
            emitToSession(sessionId, 'auth-status', {
              sessionId: sessionId,
              status: 'connecting',
              message: 'Connecting to WhatsApp...'
            });
          } catch (error) {
            logger.warn('Failed to emit connecting status:', error.message);
          }
        }
        
        else if (connection === 'open') {
          logger.info(`✅ WhatsApp connected successfully for session: ${sessionId}`);
          logger.info(`📱 User info:`, {
            id: sock.user?.id,
            name: sock.user?.name,
            phone: sock.user?.id?.split(':')[0]
          });
          
          isConnected = true;
          connectionStatus = 'connected';
          this.activeConnections.set(sessionId, sock);
          
          await SessionManager.updateSessionStatus(sessionId, 'connected', {
            user: sock.user,
            phoneNumber: sock.user?.id?.split(':')[0] || null,
            connectionData: {
              connectedAt: new Date(),
              userAgent: sock.user?.name,
              deviceId: sock.user?.id
            }
          });
          
          // Set up message and event handlers
          this.setupEventHandlers(sock, sessionId);
          
          // 🚨 CRITICAL: Notify frontend via WebSocket of successful authentication
          try {
            const userData = {
              id: sock.user?.id,
              name: sock.user?.name,
              phone: sock.user?.id?.split(':')[0]
            };
            
            console.log(`🔔 Emitting auth-success for session: ${sessionId}`);
            console.log(`📱 User data:`, userData);
            
            // Add a small delay to ensure session is fully established
            setTimeout(() => {
              emitToSession(sessionId, 'auth-success', {
                sessionId: sessionId,
                status: 'authenticated', 
                user: userData,
                message: 'WhatsApp authentication successful!',
                timestamp: new Date().toISOString()
              });
              console.log(`✅ Frontend notified of successful authentication for ${sessionId}`);
            }, 1000); // 1 second delay
            
          } catch (error) {
            logger.error('Failed to emit auth-success:', error.message);
            console.error('Full error:', error);
          }
          
          clearTimeout(timeout);
          
          // Don't resolve here if QR was already sent
          if (!qrCodeData) {
            resolve({ 
              message: 'Connected successfully',
              status: connectionStatus,
              user: {
                id: sock.user?.id,
                name: sock.user?.name,
                phone: sock.user?.id?.split(':')[0]
              }
            });
          }
        }
        
        else if (connection === 'close') {
          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
          const reason = lastDisconnect?.error?.output?.statusCode;
          
          console.log(`❌ Connection closed for session ${sessionId}. Reason: ${reason}`);
          
          // Handle specific error codes
          if (reason === 515) {
            console.log('🔄 Error 515: Connection restart required after pairing');
            isPaired = true;
            
            // Notify frontend that syncing is happening
            try {
              emitToSession(sessionId, 'auth-status', {
                sessionId: sessionId,
                status: 'syncing',
                message: 'WhatsApp is syncing data...'
              });
              console.log(`🔄 Frontend notified of syncing status for ${sessionId}`);
            } catch (error) {
              logger.warn('Failed to emit syncing status:', error.message);
            }
            
            // Wait a moment and then reconnect
            setTimeout(async () => {
              try {
                console.log('🔄 Attempting to reconnect after successful pairing...');
                await this.reconnectSession(sessionId);
              } catch (error) {
                console.log('❌ Reconnection failed:', error.message);
              }
            }, 3000);
            
            // Don't reject if we're paired, let the reconnection handle it
            if (!qrCodeData) {
              clearTimeout(timeout);
              resolve({
                message: 'QR scan successful, establishing connection...',
                status: 'pairing_success',
                sessionId: sessionId
              });
            }
          }
          else if (shouldReconnect && !isPaired) {
            console.log(`🔄 Will attempt to reconnect session ${sessionId}`);
            connectionStatus = 'reconnecting';
            await SessionManager.updateSessionStatus(sessionId, 'reconnecting');
          } 
          else {
            console.log(`🚪 Session ${sessionId} logged out permanently`);
            connectionStatus = 'logged_out';
            this.activeConnections.delete(sessionId);
            await SessionManager.removeSession(sessionId, 'logged_out');
          }
        }
      });
    });
  }

  getConnectionStatus(sessionId) {
    const session = this.activeConnections.get(sessionId);
    if (session) {
      return session;
    }
    return WhatsAppSessionDAO.findSessionById(sessionId);
  }

  // Setup event handlers for connected session
  setupEventHandlers(sock, sessionId) {
    logger.info(`🔧 Setting up event handlers for session: ${sessionId}`);
    // Handle incoming messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      try {
        logger.info(`📨 Received ${messages.length} messages for session ${sessionId}`);
        for (const message of messages) {
          // Skip condition: only process new messages
          if (message.key.fromMe || !message.message) continue;

          const msgContent = message.message?.conversation || 
                             message.message?.extendedTextMessage?.text || 
                             'Media message';

          const messageData = {
            messageId: message.key.id,
            sessionId,
            chatId: message.key.remoteJid,
            fromMe: message.key.fromMe,
            sender: message.key.fromMe ? sessionId : message.key.remoteJid,
            recipient: message.key.fromMe ? message.key.remoteJid : sessionId,
            messageType: this.determineMessageType(message),
            content: this.extractMessageContent(message),
            timestamp: message.messageTimestamp || new Date(),
            status: 'received',
            rawMessage: message
          };

          // Save message to database
          await MessageDAO.saveMessage(messageData);

          logger.info(`📥 New message saved:`, messageData);
          
          // Update session activity
          SessionManager.updateSessionActivity(sessionId);
        }
      } catch (error) {
        logger.error(`Error handling messages for ${sessionId}:`, error);
      }
    });

    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;
      
      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        
        if (shouldReconnect) {
          logger.warn(`🔄 Connection lost for ${sessionId}, will reconnect...`);
          await SessionManager.updateSessionStatus(sessionId, 'reconnecting');
        } else {
          logger.warn(`🚪 Session ${sessionId} permanently closed`);
          await SessionManager.removeSession(sessionId, 'disconnected');
        }
      }
    });

    // Handle contact updates
    sock.ev.on('contacts.update', (contacts) => {
      logger.debug(`📱 Contact updates for ${sessionId}:`, contacts.length);
    });

    // Handle chats
    sock.ev.on('chats.set', ({ chats }) => {
      logger.info(`💬 Loaded ${chats.length} chats for session ${sessionId}`);
    });

    logger.info(`✅ Event handlers setup completed for session: ${sessionId}`);
  }

  // Send a test message to verify connection
  async sendTestMessage(sessionId, to, message) {
    try {
      const sock = this.activeConnections.get(sessionId);
      if (!sock) {
        throw new Error('Session not found or not connected');
      }

      const result = await sock.sendMessage(to, { text: message });
      
      // Save message to database
      const messageData = {
        messageId: result.key.id,
        sessionId,
        chatId: to,
        fromMe: true,
        sender: sessionId,
        recipient: to,
        messageType: 'text',
        content: { text: message },
        timestamp: new Date(result.messageTimestamp * 1000),
        status: 'sent',
        rawMessage: result
      };
      
      await MessageDAO.saveMessage(messageData);
      logger.info(`📤 Test message sent from ${sessionId} to ${to}`);
      
      // Update session activity
      SessionManager.updateSessionActivity(sessionId);
      
      return result;
    } catch (error) {
      logger.error(`Error sending test message from ${sessionId}:`, error);
      throw error;
    }
  }

  // Send text message
  async sendTextMessage(sessionId, to, text, options = {}) {
    try {
      const sock = this.activeConnections.get(sessionId);
      if (!sock) {
        throw new Error('Session not found or not connected');
      }

      const messageContent = { text };
      
      // Add quoted message if provided
      if (options.quotedMessageId) {
        const quotedMsg = await MessageDAO.getMessageById(options.quotedMessageId, sessionId);
        if (quotedMsg) {
          messageContent.quoted = quotedMsg.rawMessage;
        }
      }

      const result = await sock.sendMessage(to, messageContent);
      
      // Save to database
      const messageData = {
        messageId: result.key.id,
        sessionId,
        chatId: to,
        fromMe: true,
        sender: sessionId,
        recipient: to,
        messageType: 'text',
        content: { text },
        timestamp: new Date(result.messageTimestamp * 1000),
        status: 'sent',
        quotedMessage: options.quotedMessageId ? {
          messageId: options.quotedMessageId,
          content: text.substring(0, 100),
          sender: sessionId
        } : undefined,
        rawMessage: result
      };
      
      await MessageDAO.saveMessage(messageData);
      SessionManager.updateSessionActivity(sessionId);
      
      return result;
    } catch (error) {
      logger.error(`Error sending text message from ${sessionId}:`, error);
      throw error;
    }
  }

  // Send image message
  async sendImageMessage(sessionId, to, imageBuffer, caption = '', mimeType = 'image/jpeg') {
    try {
      const sock = this.activeConnections.get(sessionId);
      if (!sock) {
        throw new Error('Session not found or not connected');
      }

      const result = await sock.sendMessage(to, {
        image: imageBuffer,
        caption: caption,
        mimetype: mimeType
      });
      
      // Save to database
      const messageData = {
        messageId: result.key.id,
        sessionId,
        chatId: to,
        fromMe: true,
        sender: sessionId,
        recipient: to,
        messageType: 'image',
        content: { 
          caption,
          mimeType,
          fileSize: imageBuffer.length
        },
        timestamp: new Date(result.messageTimestamp * 1000),
        status: 'sent',
        rawMessage: result
      };
      
      await MessageDAO.saveMessage(messageData);
      SessionManager.updateSessionActivity(sessionId);
      
      return result;
    } catch (error) {
      logger.error(`Error sending image message from ${sessionId}:`, error);
      throw error;
    }
  }

  // Send document message
  async sendDocumentMessage(sessionId, to, documentBuffer, fileName, mimeType) {
    try {
      const sock = this.activeConnections.get(sessionId);
      if (!sock) {
        throw new Error('Session not found or not connected');
      }

      const result = await sock.sendMessage(to, {
        document: documentBuffer,
        fileName: fileName,
        mimetype: mimeType
      });
      
      // Save to database
      const messageData = {
        messageId: result.key.id,
        sessionId,
        chatId: to,
        fromMe: true,
        sender: sessionId,
        recipient: to,
        messageType: 'document',
        content: { 
          fileName,
          mimeType,
          fileSize: documentBuffer.length
        },
        timestamp: new Date(result.messageTimestamp * 1000),
        status: 'sent',
        rawMessage: result
      };
      
      await MessageDAO.saveMessage(messageData);
      SessionManager.updateSessionActivity(sessionId);
      
      return result;
    } catch (error) {
      logger.error(`Error sending document message from ${sessionId}:`, error);
      throw error;
    }
  }

  // Send location message
  async sendLocationMessage(sessionId, to, latitude, longitude, address = '') {
    try {
      const sock = this.activeConnections.get(sessionId);
      if (!sock) {
        throw new Error('Session not found or not connected');
      }

      const result = await sock.sendMessage(to, {
        location: {
          degreesLatitude: latitude,
          degreesLongitude: longitude,
          address: address
        }
      });
      
      // Save to database
      const messageData = {
        messageId: result.key.id,
        sessionId,
        chatId: to,
        fromMe: true,
        sender: sessionId,
        recipient: to,
        messageType: 'location',
        content: { 
          location: {
            latitude,
            longitude,
            address
          }
        },
        timestamp: new Date(result.messageTimestamp * 1000),
        status: 'sent',
        rawMessage: result
      };
      
      await MessageDAO.saveMessage(messageData);
      SessionManager.updateSessionActivity(sessionId);
      
      return result;
    } catch (error) {
      logger.error(`Error sending location message from ${sessionId}:`, error);
      throw error;
    }
  }

  // Get chat messages
  async getChatMessages(sessionId, chatId, limit = 20, offset = 0) {
    try {
      return await MessageDAO.getRecentMessages(sessionId, chatId, limit, offset);
    } catch (error) {
      logger.error(`Error getting chat messages for ${sessionId}:`, error);
      throw error;
    }
  }

  // Get all chats
  async getAllChats(sessionId, limit = 50) {
    try {
      return await MessageDAO.getAllChatsWithLastMessage(sessionId, limit);
    } catch (error) {
      logger.error(`Error getting all chats for ${sessionId}:`, error);
      throw error;
    }
  }

  // Mark messages as read
  async markMessagesAsRead(sessionId, chatId) {
    try {
      const sock = this.activeConnections.get(sessionId);
      if (!sock) {
        throw new Error('Session not found or not connected');
      }

      // Mark as read in WhatsApp
      await sock.readMessages([{ remoteJid: chatId, id: 'all', participant: undefined }]);
      
      // Update database
      await MessageDAO.markMessagesAsRead(sessionId, chatId);
      
      SessionManager.updateSessionActivity(sessionId);
      return true;
    } catch (error) {
      logger.error(`Error marking messages as read for ${sessionId}:`, error);
      throw error;
    }
  }

  // Get session info
  async getSessionInfo(sessionId) {
    try {
      const sock = this.activeConnections.get(sessionId);
      if (!sock) {
        return null;
      }

      return {
        sessionId,
        user: sock.user,
        isConnected: true,
        phoneNumber: sock.user?.id?.split(':')[0],
        name: sock.user?.name,
        lastActivity: new Date()
      };
    } catch (error) {
      logger.error(`Error getting session info for ${sessionId}:`, error);
      return null;
    }
  }

  // Get all active sessions
  async getAllActiveSessions() {
    try {
      const sessions = [];
      
      for (const [sessionId, sock] of this.activeConnections.entries()) {
        try {
          if (sock && sock.user) {
            sessions.push({
              sessionId,
              user: sock.user,
              isConnected: true,
              phoneNumber: sock.user?.id?.split(':')[0],
              name: sock.user?.name,
              lastActivity: new Date()
            });
          }
        } catch (error) {
          logger.warn(`Error getting info for session ${sessionId}:`, error);
        }
      }
      
      return sessions;
    } catch (error) {
      logger.error('Error getting all active sessions:', error);
      return [];
    }
  }

  // Attempt reconnection with existing credentials
  async attemptReconnection(sessionId) {
    try {
      console.log(`🔄 Attempting auto-reconnection for session: ${sessionId}`);
      
      // Get session path
      const sessionPath = path.join(process.cwd(), 'sessions', sessionId);
      
      // Load auth state
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
      
      // Check if we have valid credentials
      if (!state.creds || !state.creds.me || !state.creds.me.id) {
        console.log(`❌ No valid credentials found for ${sessionId}`);
        return null;
      }
      
      console.log(`✅ Valid credentials found for ${sessionId}, attempting connection...`);
      
      // Create socket with existing credentials
      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: baileysLogger,
        browser: ['WhatsApp Web', 'Chrome', '1.0.0'],
        connectTimeoutMs: 30000,
        defaultQueryTimeoutMs: 30000,
        keepAliveIntervalMs: 10000,
        emitOwnEvents: true,
        fireInitQueries: true,
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        markOnlineOnConnect: true,
        shouldSyncHistoryMessage: msg => {
          return !!msg.message && !msg.key.remoteJid?.endsWith('@g.us');
        },
        linkPreviewImageThumbnailWidth: 192,
        transactionOpts: {
          maxCommitRetries: 5,
          delayBetweenTriesMs: 3000
        }
      });
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.log(`⏰ Auto-reconnection timeout for ${sessionId}`);
          sock.end(undefined);
          resolve(null);
        }, 20000); // 20 second timeout for auto-reconnection
        
        sock.ev.on('creds.update', async () => {
          try {
            await saveCreds();
            console.log(`🔐 Credentials updated during auto-reconnection: ${sessionId}`);
          } catch (error) {
            console.log(`❌ Error saving credentials during auto-reconnection:`, error);
          }
        });
        
        sock.ev.on('connection.update', async (update) => {
          const { connection, lastDisconnect } = update;
          
          console.log(`🔄 Auto-reconnection update for ${sessionId}:`, { 
            connection,
            lastDisconnect: lastDisconnect?.error?.output?.statusCode 
          });
          
          if (connection === 'open') {
            console.log(`✅ Auto-reconnection successful for session: ${sessionId}`);
            clearTimeout(timeout);
            
            // Store the connected session
            this.activeConnections.set(sessionId, sock);
            
            // Set up message handlers
            this.setupEventHandlers(sock, sessionId);
            
            // Update session status
            await SessionManager.updateSessionStatus(sessionId, 'connected', {
              user: sock.user,
              phoneNumber: sock.user?.id?.split(':')[0] || null,
              connectionData: {
                connectedAt: new Date(),
                userAgent: sock.user?.name,
                deviceId: sock.user?.id,
                autoReconnected: true
              }
            });
            
            const userData = {
              id: sock.user?.id,
              name: sock.user?.name,
              phone: sock.user?.id?.split(':')[0]
            };
            
            // Notify frontend immediately
            try {
              emitToSession(sessionId, 'auth-success', {
                sessionId: sessionId,
                status: 'authenticated',
                user: userData,
                message: 'WhatsApp auto-reconnected successfully!',
                timestamp: new Date().toISOString(),
                autoReconnected: true
              });
              console.log(`✅ Frontend notified of auto-reconnection success for ${sessionId}`);
            } catch (error) {
              console.log(`❌ Failed to notify frontend of auto-reconnection:`, error);
            }
            
            resolve({
              status: 'connected',
              message: 'Auto-reconnected successfully',
              user: userData,
              autoReconnected: true
            });
            
          } else if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(`❌ Auto-reconnection failed for ${sessionId}. Reason: ${reason}`);
            clearTimeout(timeout);
            
            // Clean up failed connection
            this.activeConnections.delete(sessionId);
            resolve(null);
          }
        });
      });
      
    } catch (error) {
      console.log(`❌ Error in attemptReconnection for ${sessionId}:`, error.message);
      return null;
    }
  }
  
  // Reconnect session after successful pairing
  async reconnectSession(sessionId) {
    try {
      console.log(`🔄 Starting reconnection for session: ${sessionId}`);
      
      // Get session path
      const sessionPath = path.join(process.cwd(), 'sessions', sessionId);
      
      if (!fs.existsSync(sessionPath)) {
        throw new Error(`Session directory not found: ${sessionPath}`);
      }

      // Load auth state
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
      console.log(`✅ Auth state loaded for reconnection: ${sessionId}`);
      
      // Create new socket with saved credentials
      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: baileysLogger,
        browser: ['WhatsApp Web', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        emitOwnEvents: true,
        fireInitQueries: true,
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        markOnlineOnConnect: true,
        shouldSyncHistoryMessage: msg => {
          return !!msg.message && !msg.key.remoteJid?.endsWith('@g.us');
        },
        linkPreviewImageThumbnailWidth: 192,
        transactionOpts: {
          maxCommitRetries: 5,
          delayBetweenTriesMs: 3000
        }
      });

      // Set up event handlers for reconnected session
      sock.ev.on('creds.update', async () => {
        try {
          await saveCreds();
          console.log(`🔐 Credentials updated during reconnection: ${sessionId}`);
        } catch (error) {
          console.log(`❌ Error saving credentials during reconnection:`, error);
        }
      });

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        console.log(`🔄 Reconnection update for ${sessionId}:`, { 
          connection,
          lastDisconnect: lastDisconnect?.error?.output?.statusCode 
        });
        
        if (connection === 'open') {
          console.log(`✅ Reconnection successful for session: ${sessionId}`);
          console.log(`📱 User info:`, {
            id: sock.user?.id,
            name: sock.user?.name,
            phone: sock.user?.id?.split(':')[0]
          });
          
          // Store the connected session
          this.activeConnections.set(sessionId, sock);
          
          // Update session status
          await SessionManager.updateSessionStatus(sessionId, 'connected', {
            user: sock.user,
            phoneNumber: sock.user?.id?.split(':')[0] || null,
            connectionData: {
              connectedAt: new Date(),
              userAgent: sock.user?.name,
              deviceId: sock.user?.id,
              reconnected: true
            }
          });
          
          // Set up message handlers
          this.setupEventHandlers(sock, sessionId);
          
          // 🚨 CRITICAL: Notify frontend via WebSocket of successful reconnection
          try {
            const userData = {
              id: sock.user?.id,
              name: sock.user?.name,
              phone: sock.user?.id?.split(':')[0]
            };
            
            console.log(`🔔 Emitting auth-success for reconnected session: ${sessionId}`);
            emitToSession(sessionId, 'auth-success', {
              sessionId: sessionId,
              status: 'authenticated',
              user: userData,
              message: 'WhatsApp reconnection successful!',
              timestamp: new Date().toISOString(),
              reconnected: true
            });
            
            console.log(`✅ Frontend notified of successful reconnection for ${sessionId}`);
          } catch (error) {
            logger.error('Failed to emit reconnection auth-success:', error.message);
          }
          
          console.log(`🎉 Session ${sessionId} is now fully connected and active!`);
          
        } else if (connection === 'close') {
          const reason = lastDisconnect?.error?.output?.statusCode;
          console.log(`❌ Reconnection failed for ${sessionId}. Reason: ${reason}`);
          
          if (reason !== DisconnectReason.loggedOut) {
            console.log(`🔄 Will retry reconnection for ${sessionId} in 10 seconds...`);
            setTimeout(() => {
              this.reconnectSession(sessionId).catch(err => {
                console.log(`❌ Retry reconnection failed:`, err.message);
              });
            }, 10000);
          }
        }
      });
      
      console.log(`🚀 Reconnection socket created for session: ${sessionId}`);
      
    } catch (error) {
      console.log(`❌ Error in reconnectSession for ${sessionId}:`, error.message);
      throw error;
    }
  }

  // Helper method to determine message type
  determineMessageType(message) {
    if (message.message?.conversation || message.message?.extendedTextMessage) {
      return 'text';
    } else if (message.message?.imageMessage) {
      return 'image';
    } else if (message.message?.videoMessage) {
      return 'video';
    } else if (message.message?.audioMessage) {
      return 'audio';
    } else if (message.message?.documentMessage) {
      return 'document';
    } else if (message.message?.stickerMessage) {
      return 'sticker';
    } else if (message.message?.locationMessage) {
      return 'location';
    } else if (message.message?.contactMessage) {
      return 'contact';
    } else {
      return 'other';
    }
  }

  // Helper method to extract message content
  extractMessageContent(message) {
    const content = {};
    
    if (message.message?.conversation) {
      content.text = message.message.conversation;
    } else if (message.message?.extendedTextMessage) {
      content.text = message.message.extendedTextMessage.text;
    } else if (message.message?.imageMessage) {
      content.caption = message.message.imageMessage.caption;
      content.mimeType = message.message.imageMessage.mimetype;
    } else if (message.message?.videoMessage) {
      content.caption = message.message.videoMessage.caption;
      content.mimeType = message.message.videoMessage.mimetype;
      content.duration = message.message.videoMessage.seconds;
    } else if (message.message?.audioMessage) {
      content.mimeType = message.message.audioMessage.mimetype;
      content.duration = message.message.audioMessage.seconds;
    } else if (message.message?.documentMessage) {
      content.fileName = message.message.documentMessage.fileName;
      content.mimeType = message.message.documentMessage.mimetype;
      content.fileSize = message.message.documentMessage.fileLength;
    } else if (message.message?.locationMessage) {
      content.location = {
        latitude: message.message.locationMessage.degreesLatitude,
        longitude: message.message.locationMessage.degreesLongitude,
        address: message.message.locationMessage.address
      };
    } else if (message.message?.contactMessage) {
      content.contact = {
        name: message.message.contactMessage.displayName,
        phone: message.message.contactMessage.vcard
      };
    }
    
    return content;
  }

  async logoutSession(sessionId) {
    try {
      const session = this.activeConnections.get(sessionId);
      if (session) {
        logger.info(`🚪 Logging out session: ${sessionId}`);
        await session.logout();
        this.activeConnections.delete(sessionId);
      }
      
      await SessionManager.removeSession(sessionId, 'manual');
      logger.info(`✅ Session ${sessionId} logged out successfully`);
    } catch (error) {
      logger.error(`Error logging out session ${sessionId}:`, error);
      throw error;
    }
  }
}

export default new WhatsAppService();
