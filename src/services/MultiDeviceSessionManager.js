import WhatsAppSessionDAO from '../dao/WhatsAppSessionDAO.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

class MultiDeviceSessionManager {
  constructor() {
    // Map of phoneNumber -> Set of deviceSessions
    this.phoneNumberSessions = new Map();
    
    // Map of deviceSessionId -> session data
    this.deviceSessions = new Map();
    
    // Map for tracking QR timers per device
    this.qrTimers = new Map();
    
    // Map for tracking session timers per device
    this.sessionTimers = new Map();
    
    // Cleanup interval
    this.cleanupInterval = null;
    
    // Configuration for multi-device management
    this.config = {
      MAX_DEVICES_PER_PHONE: 50, // Maximum devices per phone number
      QR_EXPIRY_TIME: 5 * 60 * 1000, // 5 minutes
      SESSION_IDLE_TIME: 30 * 60 * 1000, // 30 minutes
      MAX_SESSION_TIME: 24 * 60 * 60 * 1000, // 24 hours
      CLEANUP_INTERVAL: 10 * 60 * 1000, // 10 minutes
      DEVICE_HEARTBEAT_INTERVAL: 5 * 60 * 1000, // 5 minutes
      MAX_FAILED_HEARTBEATS: 3 // Max failed heartbeats before marking device as inactive
    };
    
    this.startCleanupScheduler();
  }

  // Generate unique device session ID
  generateDeviceSessionId(phoneNumber, deviceName = null) {
    const timestamp = Date.now();
    const randomId = uuidv4().substring(0, 8);
    const devicePrefix = deviceName ? deviceName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10) : 'device';
    return `${phoneNumber}_${devicePrefix}_${timestamp}_${randomId}`;
  }

  // Add a new device session for a phone number
  async addDeviceSession(phoneNumber, deviceSessionId, socket, deviceInfo = {}) {
    try {
      // Validate phone number format
      const cleanPhoneNumber = this.cleanPhoneNumber(phoneNumber);
      
      // Check if phone number already has too many devices
      const existingSessions = this.phoneNumberSessions.get(cleanPhoneNumber) || new Set();
      
      if (existingSessions.size >= this.config.MAX_DEVICES_PER_PHONE) {
        // Remove oldest inactive session to make room
        await this.removeOldestInactiveSession(cleanPhoneNumber);
      }

      // Create device session data
      const deviceSessionData = {
        deviceSessionId,
        phoneNumber: cleanPhoneNumber,
        socket,
        deviceInfo: {
          deviceName: deviceInfo.deviceName || `Device_${existingSessions.size + 1}`,
          userAgent: deviceInfo.userAgent || 'Unknown',
          ipAddress: deviceInfo.ipAddress || 'Unknown',
          platform: deviceInfo.platform || 'Unknown',
          ...deviceInfo
        },
        createdAt: new Date(),
        lastActivity: new Date(),
        lastHeartbeat: new Date(),
        status: 'connecting',
        isActive: true,
        failedHeartbeats: 0,
        messagesSent: 0,
        messagesReceived: 0
      };

      // Add to device sessions map
      this.deviceSessions.set(deviceSessionId, deviceSessionData);
      
      // Add to phone number sessions map
      if (!this.phoneNumberSessions.has(cleanPhoneNumber)) {
        this.phoneNumberSessions.set(cleanPhoneNumber, new Set());
      }
      this.phoneNumberSessions.get(cleanPhoneNumber).add(deviceSessionId);

      // Set session expiration timer
      this.setSessionTimer(deviceSessionId);
      
      logger.info(`Device session ${deviceSessionId} added for phone ${cleanPhoneNumber}`);
      return deviceSessionData;
    } catch (error) {
      logger.error(`Error adding device session ${deviceSessionId}:`, error);
      throw error;
    }
  }

  // Remove device session
  async removeDeviceSession(deviceSessionId, reason = 'manual') {
    try {
      const deviceSession = this.deviceSessions.get(deviceSessionId);
      
      if (deviceSession) {
        const { phoneNumber, socket } = deviceSession;
        
        // Close socket connection
        if (socket && typeof socket.end === 'function') {
          try {
            socket.end();
          } catch (error) {
            logger.warn(`Error closing socket for ${deviceSessionId}:`, error.message);
          }
        }
        
        // Remove from device sessions
        this.deviceSessions.delete(deviceSessionId);
        
        // Remove from phone number sessions
        const phoneNumberSessions = this.phoneNumberSessions.get(phoneNumber);
        if (phoneNumberSessions) {
          phoneNumberSessions.delete(deviceSessionId);
          
          // Remove phone number entry if no more devices
          if (phoneNumberSessions.size === 0) {
            this.phoneNumberSessions.delete(phoneNumber);
          }
        }
      }

      // Clear timers
      this.clearSessionTimer(deviceSessionId);
      this.clearQRTimer(deviceSessionId);

      // Update database
      await WhatsAppSessionDAO.deactivateSession(deviceSessionId);

      // Clean up session files if manual logout
      if (reason === 'manual' || reason === 'logout') {
        await this.cleanupSessionFiles(deviceSessionId);
      }

      logger.info(`Device session ${deviceSessionId} removed (reason: ${reason})`);
      return true;
    } catch (error) {
      logger.error(`Error removing device session ${deviceSessionId}:`, error);
      throw error;
    }
  }

  // Get all device sessions for a phone number
  getDeviceSessionsForPhone(phoneNumber) {
    const cleanPhoneNumber = this.cleanPhoneNumber(phoneNumber);
    const deviceSessionIds = this.phoneNumberSessions.get(cleanPhoneNumber) || new Set();
    
    const sessions = [];
    for (const deviceSessionId of deviceSessionIds) {
      const session = this.deviceSessions.get(deviceSessionId);
      if (session) {
        sessions.push({
          deviceSessionId,
          deviceName: session.deviceInfo.deviceName,
          status: session.status,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          lastHeartbeat: session.lastHeartbeat,
          isActive: session.isActive,
          messagesSent: session.messagesSent,
          messagesReceived: session.messagesReceived
        });
      }
    }
    
    return sessions;
  }

  // Get device session by ID
  getDeviceSession(deviceSessionId) {
    return this.deviceSessions.get(deviceSessionId);
  }

  // Update device session activity
  updateDeviceActivity(deviceSessionId) {
    const deviceSession = this.deviceSessions.get(deviceSessionId);
    if (deviceSession) {
      deviceSession.lastActivity = new Date();
      deviceSession.lastHeartbeat = new Date();
      deviceSession.failedHeartbeats = 0;
      this.setSessionTimer(deviceSessionId); // Reset the timer
    }
  }

  // Update device session status
  async updateDeviceSessionStatus(deviceSessionId, status, additionalData = {}) {
    try {
      const deviceSession = this.deviceSessions.get(deviceSessionId);
      if (deviceSession) {
        deviceSession.status = status;
        deviceSession.lastActivity = new Date();
        Object.assign(deviceSession, additionalData);
      }

      // Handle status-specific logic
      switch (status) {
        case 'qr_generated':
          this.setQRTimer(deviceSessionId);
          break;
        case 'connected':
          this.clearQRTimer(deviceSessionId);
          this.setSessionTimer(deviceSessionId);
          break;
        case 'disconnected':
        case 'logged_out':
          await this.removeDeviceSession(deviceSessionId, status);
          break;
      }

      await WhatsAppSessionDAO.updateSessionStatus(deviceSessionId, status, additionalData);
      return true;
    } catch (error) {
      logger.error(`Error updating device session status for ${deviceSessionId}:`, error);
      throw error;
    }
  }

  // Broadcast message to all active devices of a phone number
  async broadcastToAllDevices(phoneNumber, eventType, data) {
    const cleanPhoneNumber = this.cleanPhoneNumber(phoneNumber);
    const deviceSessionIds = this.phoneNumberSessions.get(cleanPhoneNumber) || new Set();
    
    const results = [];
    
    for (const deviceSessionId of deviceSessionIds) {
      const deviceSession = this.deviceSessions.get(deviceSessionId);
      
      if (deviceSession && deviceSession.isActive && deviceSession.socket) {
        try {
          // Emit event to device socket
          if (typeof deviceSession.socket.emit === 'function') {
            deviceSession.socket.emit(eventType, data);
            results.push({ deviceSessionId, success: true });
          }
        } catch (error) {
          logger.error(`Error broadcasting to device ${deviceSessionId}:`, error);
          results.push({ deviceSessionId, success: false, error: error.message });
        }
      }
    }
    
    return results;
  }

  // Get active device for sending messages (load balancing)
  getActiveDeviceForSending(phoneNumber) {
    const cleanPhoneNumber = this.cleanPhoneNumber(phoneNumber);
    const deviceSessionIds = this.phoneNumberSessions.get(cleanPhoneNumber) || new Set();
    
    let bestDevice = null;
    let lowestLoad = Infinity;
    
    for (const deviceSessionId of deviceSessionIds) {
      const deviceSession = this.deviceSessions.get(deviceSessionId);
      
      if (deviceSession && 
          deviceSession.isActive && 
          deviceSession.status === 'connected' &&
          deviceSession.socket) {
        
        // Calculate load (messages sent in last hour)
        const load = deviceSession.messagesSent;
        
        if (load < lowestLoad) {
          lowestLoad = load;
          bestDevice = deviceSession;
        }
      }
    }
    
    return bestDevice;
  }

  // Set QR expiration timer
  setQRTimer(deviceSessionId) {
    this.clearQRTimer(deviceSessionId);
    
    const timer = setTimeout(async () => {
      try {
        logger.info(`QR code expired for device session ${deviceSessionId}`);
        await this.handleQRExpiry(deviceSessionId);
      } catch (error) {
        logger.error(`Error handling QR expiry for ${deviceSessionId}:`, error);
      }
    }, this.config.QR_EXPIRY_TIME);

    this.qrTimers.set(deviceSessionId, timer);
  }

  // Clear QR timer
  clearQRTimer(deviceSessionId) {
    const timer = this.qrTimers.get(deviceSessionId);
    if (timer) {
      clearTimeout(timer);
      this.qrTimers.delete(deviceSessionId);
    }
  }

  // Handle QR expiry
  async handleQRExpiry(deviceSessionId) {
    try {
      const deviceSession = this.deviceSessions.get(deviceSessionId);
      
      if (deviceSession && deviceSession.status === 'qr_generated') {
        await this.updateDeviceSessionStatus(deviceSessionId, 'qr_expired');
        await this.removeDeviceSession(deviceSessionId, 'qr_expired');
        logger.info(`Device session ${deviceSessionId} removed due to QR expiry`);
      }
    } catch (error) {
      logger.error(`Error handling QR expiry for ${deviceSessionId}:`, error);
    }
  }

  // Set session expiration timer
  setSessionTimer(deviceSessionId) {
    this.clearSessionTimer(deviceSessionId);
    
    const timer = setTimeout(async () => {
      try {
        logger.info(`Device session ${deviceSessionId} expired due to inactivity`);
        await this.removeDeviceSession(deviceSessionId, 'expired');
      } catch (error) {
        logger.error(`Error expiring device session ${deviceSessionId}:`, error);
      }
    }, this.config.SESSION_IDLE_TIME);

    this.sessionTimers.set(deviceSessionId, timer);
  }

  // Clear session timer
  clearSessionTimer(deviceSessionId) {
    const timer = this.sessionTimers.get(deviceSessionId);
    if (timer) {
      clearTimeout(timer);
      this.sessionTimers.delete(deviceSessionId);
    }
  }

  // Remove oldest inactive session to make room for new ones
  async removeOldestInactiveSession(phoneNumber) {
    const deviceSessionIds = this.phoneNumberSessions.get(phoneNumber) || new Set();
    
    let oldestInactive = null;
    let oldestTime = new Date();
    
    for (const deviceSessionId of deviceSessionIds) {
      const deviceSession = this.deviceSessions.get(deviceSessionId);
      
      if (deviceSession && 
          (!deviceSession.isActive || deviceSession.status !== 'connected') &&
          deviceSession.lastActivity < oldestTime) {
        oldestTime = deviceSession.lastActivity;
        oldestInactive = deviceSessionId;
      }
    }
    
    if (oldestInactive) {
      await this.removeDeviceSession(oldestInactive, 'auto_cleanup');
      logger.info(`Removed oldest inactive session ${oldestInactive} for phone ${phoneNumber}`);
    }
  }

  // Clean up session files
  async cleanupSessionFiles(deviceSessionId) {
    try {
      const sessionPath = path.join(process.cwd(), 'sessions', deviceSessionId);
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        logger.info(`Cleaned up session files for ${deviceSessionId}`);
      }
    } catch (error) {
      logger.error(`Error cleaning up session files for ${deviceSessionId}:`, error);
    }
  }

  // Start cleanup scheduler
  startCleanupScheduler() {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.config.CLEANUP_INTERVAL);
    
    logger.info('Multi-device session cleanup scheduler started');
  }

  // Stop cleanup scheduler
  stopCleanupScheduler() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Multi-device session cleanup scheduler stopped');
    }
  }

  // Perform cleanup
  async performCleanup() {
    try {
      const now = new Date();
      const sessionsToRemove = [];

      // Check for expired device sessions
      for (const [deviceSessionId, deviceSession] of this.deviceSessions.entries()) {
        const timeSinceLastActivity = now - deviceSession.lastActivity;
        const timeSinceCreation = now - deviceSession.createdAt;
        const timeSinceLastHeartbeat = now - deviceSession.lastHeartbeat;

        // Mark as inactive if no heartbeat for too long
        if (timeSinceLastHeartbeat > this.config.DEVICE_HEARTBEAT_INTERVAL * 2) {
          deviceSession.failedHeartbeats++;
          
          if (deviceSession.failedHeartbeats >= this.config.MAX_FAILED_HEARTBEATS) {
            deviceSession.isActive = false;
          }
        }

        // Remove if idle for too long or exceeded max time
        if (timeSinceLastActivity > this.config.SESSION_IDLE_TIME || 
            timeSinceCreation > this.config.MAX_SESSION_TIME ||
            !deviceSession.isActive) {
          sessionsToRemove.push(deviceSessionId);
        }
      }

      // Remove expired sessions
      for (const deviceSessionId of sessionsToRemove) {
        await this.removeDeviceSession(deviceSessionId, 'cleanup');
      }

      if (sessionsToRemove.length > 0) {
        logger.info(`Multi-device cleanup completed: removed ${sessionsToRemove.length} sessions`);
      }
    } catch (error) {
      logger.error('Error during multi-device cleanup:', error);
    }
  }

  // Clean phone number format
  cleanPhoneNumber(phoneNumber) {
    return phoneNumber.replace(/[^0-9]/g, '');
  }

  // Get statistics
  getStats() {
    const stats = {
      totalPhoneNumbers: this.phoneNumberSessions.size,
      totalDeviceSessions: this.deviceSessions.size,
      activeDeviceSessions: 0,
      phoneNumberStats: new Map()
    };

    // Calculate phone number statistics
    for (const [phoneNumber, deviceSessionIds] of this.phoneNumberSessions.entries()) {
      let activeCount = 0;
      let connectedCount = 0;
      
      for (const deviceSessionId of deviceSessionIds) {
        const deviceSession = this.deviceSessions.get(deviceSessionId);
        if (deviceSession) {
          if (deviceSession.isActive) activeCount++;
          if (deviceSession.status === 'connected') connectedCount++;
        }
      }
      
      stats.phoneNumberStats.set(phoneNumber, {
        totalDevices: deviceSessionIds.size,
        activeDevices: activeCount,
        connectedDevices: connectedCount
      });
      
      stats.activeDeviceSessions += activeCount;
    }

    return stats;
  }

  // Graceful shutdown
  async shutdown() {
    try {
      logger.info('Shutting down multi-device session manager...');
      
      // Stop cleanup scheduler
      this.stopCleanupScheduler();

      // Close all device sessions
      const promises = [];
      for (const deviceSessionId of this.deviceSessions.keys()) {
        promises.push(this.removeDeviceSession(deviceSessionId, 'shutdown'));
      }
      
      await Promise.all(promises);
      
      // Clear all timers
      for (const timer of this.qrTimers.values()) {
        clearTimeout(timer);
      }
      for (const timer of this.sessionTimers.values()) {
        clearTimeout(timer);
      }
      
      this.qrTimers.clear();
      this.sessionTimers.clear();
      this.deviceSessions.clear();
      this.phoneNumberSessions.clear();
      
      logger.info('Multi-device session manager shutdown completed');
    } catch (error) {
      logger.error('Error during multi-device session manager shutdown:', error);
    }
  }
}

export default new MultiDeviceSessionManager();
