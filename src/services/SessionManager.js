import WhatsAppSessionDAO from '../dao/WhatsAppSessionDAO.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

class SessionManager {
  constructor() {
    this.activeConnections = new Map();
    this.qrTimers = new Map(); // Track QR expiration timers
    this.sessionTimers = new Map(); // Track session expiration timers
    this.cleanupInterval = null;
    this.isInitialized = false;
    
    // Configuration
    this.config = {
      QR_EXPIRY_TIME: 5 * 60 * 1000, // 5 minutes
      SESSION_IDLE_TIME: 15 * 60 * 1000, // 15 minutes of inactivity (reduced from 30)
      MAX_SESSION_TIME: 2 * 60 * 60 * 1000, // 2 hours max session (reduced from 24)
      CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 minutes cleanup (more frequent)
      MAX_CONCURRENT_SESSIONS: 50 // Max sessions per instance (increased for better scalability)
    };
    
    // Don't start cleanup scheduler automatically
    // this.startCleanupScheduler();
  }

  // Initialize the session manager
  initialize() {
    if (!this.isInitialized) {
      this.startCleanupScheduler();
      this.isInitialized = true;
      logger.info('SessionManager initialized');
    }
  }

  // Add a new session
  async addSession(sessionId, socket) {
    try {
      // Check concurrent session limit
      if (this.activeConnections.size >= this.config.MAX_CONCURRENT_SESSIONS) {
        throw new Error('Maximum concurrent sessions limit reached');
      }

      this.activeConnections.set(sessionId, {
        socket,
        createdAt: new Date(),
        lastActivity: new Date(),
        status: 'connecting'
      });

      // Set session expiration timer
      this.setSessionTimer(sessionId);
      
      logger.info(`Session ${sessionId} added to manager`);
      return true;
    } catch (error) {
      logger.error(`Error adding session ${sessionId}:`, error);
      throw error;
    }
  }

  // Remove session
  async removeSession(sessionId, reason = 'manual') {
    try {
      const sessionData = this.activeConnections.get(sessionId);
      
      if (sessionData) {
        // Close socket connection
        if (sessionData.socket && typeof sessionData.socket.end === 'function') {
          sessionData.socket.end();
        }
        
        this.activeConnections.delete(sessionId);
      }

      // Clear timers
      this.clearSessionTimer(sessionId);
      this.clearQRTimer(sessionId);

      // Update database
      await WhatsAppSessionDAO.deactivateSession(sessionId);

      // Clean up session files if manual logout
      if (reason === 'manual' || reason === 'logout') {
        await this.cleanupSessionFiles(sessionId);
      }

      logger.info(`Session ${sessionId} removed (reason: ${reason})`);
      return true;
    } catch (error) {
      logger.error(`Error removing session ${sessionId}:`, error);
      throw error;
    }
  }

  // Set QR expiration timer
  setQRTimer(sessionId) {
    this.clearQRTimer(sessionId); // Clear existing timer
    
    const timer = setTimeout(async () => {
      try {
        logger.info(`QR code expired for session ${sessionId}`);
        await this.handleQRExpiry(sessionId);
      } catch (error) {
        logger.error(`Error handling QR expiry for ${sessionId}:`, error);
      }
    }, this.config.QR_EXPIRY_TIME);

    this.qrTimers.set(sessionId, timer);
  }

  // Clear QR timer
  clearQRTimer(sessionId) {
    const timer = this.qrTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.qrTimers.delete(sessionId);
    }
  }

  // Handle QR expiry
  async handleQRExpiry(sessionId) {
    try {
      const sessionData = this.activeConnections.get(sessionId);
      
      if (sessionData && sessionData.status === 'qr_generated') {
        // Update status to expired
        await WhatsAppSessionDAO.updateSessionStatus(sessionId, 'qr_expired');
        
        // Remove session if not connected
        await this.removeSession(sessionId, 'qr_expired');
        
        logger.info(`Session ${sessionId} removed due to QR expiry`);
      }
    } catch (error) {
      logger.error(`Error handling QR expiry for ${sessionId}:`, error);
    }
  }

  // Set session expiration timer
  setSessionTimer(sessionId) {
    this.clearSessionTimer(sessionId);
    
    const timer = setTimeout(async () => {
      try {
        logger.info(`Session ${sessionId} expired due to inactivity`);
        await this.removeSession(sessionId, 'expired');
      } catch (error) {
        logger.error(`Error expiring session ${sessionId}:`, error);
      }
    }, this.config.SESSION_IDLE_TIME);

    this.sessionTimers.set(sessionId, timer);
  }

  // Clear session timer
  clearSessionTimer(sessionId) {
    const timer = this.sessionTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.sessionTimers.delete(sessionId);
    }
  }

  // Update session activity
  updateSessionActivity(sessionId) {
    const sessionData = this.activeConnections.get(sessionId);
    if (sessionData) {
      sessionData.lastActivity = new Date();
      this.setSessionTimer(sessionId); // Reset the timer
    }
  }

  // Update session status
  async updateSessionStatus(sessionId, status, additionalData = {}) {
    try {
      const sessionData = this.activeConnections.get(sessionId);
      if (sessionData) {
        sessionData.status = status;
        sessionData.lastActivity = new Date();
        Object.assign(sessionData, additionalData);
      }

      // Handle status-specific logic
      switch (status) {
        case 'qr_generated':
          this.setQRTimer(sessionId);
          break;
        case 'connected':
          this.clearQRTimer(sessionId);
          this.setSessionTimer(sessionId); // Reset session timer
          break;
        case 'disconnected':
        case 'logged_out':
          await this.removeSession(sessionId, status);
          break;
      }

      await WhatsAppSessionDAO.updateSessionStatus(sessionId, status, additionalData);
      return true;
    } catch (error) {
      logger.error(`Error updating session status for ${sessionId}:`, error);
      throw error;
    }
  }

  // Get session info
  getSession(sessionId) {
    return this.activeConnections.get(sessionId);
  }

  // Get all active sessions
  getAllSessions() {
    const sessions = [];
    for (const [sessionId, data] of this.activeConnections.entries()) {
      sessions.push({
        sessionId,
        status: data.status,
        createdAt: data.createdAt,
        lastActivity: data.lastActivity
      });
    }
    return sessions;
  }

  // Clean up session files
  async cleanupSessionFiles(sessionId) {
    try {
      const sessionPath = path.join(process.cwd(), 'sessions', sessionId);
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        logger.info(`Cleaned up session files for ${sessionId}`);
      }
    } catch (error) {
      logger.error(`Error cleaning up session files for ${sessionId}:`, error);
    }
  }

  // Start cleanup scheduler
  startCleanupScheduler() {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.config.CLEANUP_INTERVAL);
    
    logger.info('Session cleanup scheduler started');
  }

  // Stop cleanup scheduler
  stopCleanupScheduler() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Session cleanup scheduler stopped');
    }
  }

  // Perform cleanup
  async performCleanup() {
    try {
      const now = new Date();
      const sessionsToRemove = [];

      // Check for expired sessions
      for (const [sessionId, sessionData] of this.activeConnections.entries()) {
        const timeSinceLastActivity = now - sessionData.lastActivity;
        const timeSinceCreation = now - sessionData.createdAt;

        // Remove if idle for too long or exceeded max time
        if (timeSinceLastActivity > this.config.SESSION_IDLE_TIME || 
            timeSinceCreation > this.config.MAX_SESSION_TIME) {
          sessionsToRemove.push(sessionId);
        }
      }

      // Remove expired sessions
      for (const sessionId of sessionsToRemove) {
        await this.removeSession(sessionId, 'cleanup');
      }

      // Clean up orphaned database sessions
      await this.cleanupOrphanedSessions();

      if (sessionsToRemove.length > 0) {
        logger.info(`Cleanup completed: removed ${sessionsToRemove.length} sessions`);
      }
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }

  // Clean up orphaned database sessions
  async cleanupOrphanedSessions() {
    try {
      // This would remove database sessions that are no longer in memory
      // Implementation depends on your specific needs
      await WhatsAppSessionDAO.deleteAllSessions();
    } catch (error) {
      logger.error('Error cleaning up orphaned sessions:', error);
    }
  }

  // Graceful shutdown
  async shutdown() {
    try {
      logger.info('Shutting down session manager...');
      
      // Stop cleanup scheduler
      this.stopCleanupScheduler();

      // Close all active connections
      const promises = [];
      for (const [sessionId] of this.activeConnections.entries()) {
        promises.push(this.removeSession(sessionId, 'shutdown'));
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
      this.activeConnections.clear();
      
      logger.info('Session manager shutdown completed');
    } catch (error) {
      logger.error('Error during session manager shutdown:', error);
    }
  }

  // Get session statistics
  getStats() {
    return {
      activeSessions: this.activeConnections.size,
      maxSessions: this.config.MAX_CONCURRENT_SESSIONS,
      qrTimers: this.qrTimers.size,
      sessionTimers: this.sessionTimers.size,
      config: this.config
    };
  }
}

export default new SessionManager();
