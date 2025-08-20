import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import ApiError from '../utils/ApiError.js';

// Dynamic import Redis to prevent initialization issues
let redis = null;
async function getRedis() {
  if (!redis) {
    try {
      const redisModule = await import('../config/redis.js');
      redis = redisModule.redis;
      if (!redis) {
        // Use memory fallback if Redis is not available
        const { redisManager } = redisModule;
        redis = redisManager.createMemoryFallback();
      }
    } catch (error) {
      logger.warn('Redis not available, using memory fallback');
      // Create simple memory fallback
      redis = new Map();
      redis.setex = async (key, ttl, value) => redis.set(key, value);
      redis.get = async (key) => redis.get(key) || null;
      redis.del = async (key) => redis.delete(key);
      redis.exists = async (key) => redis.has(key) ? 1 : 0;
    }
  }
  return redis;
}

/**
 * Production-ready Authentication Service
 * Handles access/refresh tokens, secure session management
 */
class AuthService {
  constructor() {
    this.ACCESS_TOKEN_EXPIRY = '15m';
    this.REFRESH_TOKEN_EXPIRY = '7d';
    this.REFRESH_TOKEN_PREFIX = 'refresh_token:';
    this.SESSION_PREFIX = 'session:';
    this.SALT_ROUNDS = 12;
  }

  /**
   * Generate access and refresh token pair
   * @param {Object} payload - User payload
   * @returns {Object} Token pair with metadata
   */
  async generateTokenPair(payload) {
    try {
      const tokenId = this.generateTokenId();
      
      const accessToken = jwt.sign(
        { 
          ...payload, 
          type: 'access',
          tokenId,
          iat: Math.floor(Date.now() / 1000)
        },
        config.jwt.secret,
        { 
          expiresIn: this.ACCESS_TOKEN_EXPIRY,
          issuer: config.app.name,
          audience: config.app.name
        }
      );

      const refreshToken = jwt.sign(
        { 
          userId: payload.userId,
          sessionId: payload.sessionId,
          type: 'refresh',
          tokenId,
          iat: Math.floor(Date.now() / 1000)
        },
        config.jwt.secret,
        { 
          expiresIn: this.REFRESH_TOKEN_EXPIRY,
          issuer: config.app.name,
          audience: config.app.name
        }
      );

      // Store refresh token in Redis with expiration
      const redisClient = await getRedis();
      const refreshKey = `${this.REFRESH_TOKEN_PREFIX}${tokenId}`;
      await redisClient.setex(refreshKey, 7 * 24 * 60 * 60, JSON.stringify({
        userId: payload.userId,
        sessionId: payload.sessionId,
        createdAt: new Date().toISOString(),
        userAgent: payload.userAgent || 'unknown'
      }));

      logger.info(`Token pair generated for user ${payload.userId}`, { tokenId });

      return {
        accessToken,
        refreshToken,
        tokenId,
        expiresIn: 15 * 60, // 15 minutes in seconds
        tokenType: 'Bearer'
      };
    } catch (error) {
      logger.error('Token generation failed:', error);
      throw new ApiError(500, 'Token generation failed');
    }
  }

  /**
   * Verify and decode access token
   * @param {string} token - JWT access token
   * @returns {Object} Decoded payload
   */
  async verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret, {
        issuer: config.app.name,
        audience: config.app.name
      });

      if (decoded.type !== 'access') {
        throw new ApiError(401, 'Invalid token type');
      }

      // Check if session is still active
      const redisClient = await getRedis();
      const sessionKey = `${this.SESSION_PREFIX}${decoded.sessionId}`;
      const sessionExists = await redisClient.exists(sessionKey);
      
      if (!sessionExists) {
        throw new ApiError(401, 'Session expired or invalid');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new ApiError(401, 'Invalid access token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new ApiError(401, 'Access token expired');
      }
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - JWT refresh token
   * @returns {Object} New token pair
   */
  async refreshAccessToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.secret, {
        issuer: config.app.name,
        audience: config.app.name
      });

      if (decoded.type !== 'refresh') {
        throw new ApiError(401, 'Invalid refresh token type');
      }

      // Check if refresh token exists in Redis
      const redisClient = await getRedis();
      const refreshKey = `${this.REFRESH_TOKEN_PREFIX}${decoded.tokenId}`;
      const tokenData = await redisClient.get(refreshKey);
      
      if (!tokenData) {
        throw new ApiError(401, 'Refresh token expired or revoked');
      }

      const parsedData = JSON.parse(tokenData);
      
      // Revoke old refresh token
      await redisClient.del(refreshKey);

      // Generate new token pair
      return await this.generateTokenPair({
        userId: parsedData.userId,
        sessionId: parsedData.sessionId,
        userAgent: parsedData.userAgent
      });
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new ApiError(401, 'Invalid refresh token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new ApiError(401, 'Refresh token expired');
      }
      throw error;
    }
  }

  /**
   * Revoke refresh token (logout)
   * @param {string} tokenId - Token ID to revoke
   */
  async revokeRefreshToken(tokenId) {
    try {
      const refreshKey = `${this.REFRESH_TOKEN_PREFIX}${tokenId}`;
      await redis.del(refreshKey);
      logger.info(`Refresh token revoked: ${tokenId}`);
    } catch (error) {
      logger.error('Token revocation failed:', error);
      throw new ApiError(500, 'Logout failed');
    }
  }

  /**
   * Hash password using bcrypt
   * @param {string} password - Plain text password
   * @returns {string} Hashed password
   */
  async hashPassword(password) {
    try {
      return await bcrypt.hash(password, this.SALT_ROUNDS);
    } catch (error) {
      logger.error('Password hashing failed:', error);
      throw new ApiError(500, 'Password processing failed');
    }
  }

  /**
   * Compare password with hash
   * @param {string} password - Plain text password
   * @param {string} hash - Hashed password
   * @returns {boolean} Match result
   */
  async comparePassword(password, hash) {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      logger.error('Password comparison failed:', error);
      throw new ApiError(500, 'Authentication failed');
    }
  }

  /**
   * Create secure session in Redis
   * @param {string} sessionId - Session ID
   * @param {Object} sessionData - Session data
   * @param {number} ttl - Time to live in seconds
   */
  async createSession(sessionId, sessionData, ttl = 24 * 60 * 60) {
    try {
      const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
      await redis.setex(sessionKey, ttl, JSON.stringify({
        ...sessionData,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      }));
      
      logger.info(`Session created: ${sessionId}`);
    } catch (error) {
      logger.error('Session creation failed:', error);
      throw new ApiError(500, 'Session creation failed');
    }
  }

  /**
   * Get session data from Redis
   * @param {string} sessionId - Session ID
   * @returns {Object|null} Session data
   */
  async getSession(sessionId) {
    try {
      const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
      const sessionData = await redis.get(sessionKey);
      
      if (!sessionData) {
        return null;
      }

      return JSON.parse(sessionData);
    } catch (error) {
      logger.error('Session retrieval failed:', error);
      return null;
    }
  }

  /**
   * Update session activity
   * @param {string} sessionId - Session ID
   */
  async updateSessionActivity(sessionId) {
    try {
      const session = await this.getSession(sessionId);
      if (session) {
        session.lastActivity = new Date().toISOString();
        const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
        const ttl = await redis.ttl(sessionKey);
        await redis.setex(sessionKey, ttl > 0 ? ttl : 24 * 60 * 60, JSON.stringify(session));
      }
    } catch (error) {
      logger.error('Session activity update failed:', error);
    }
  }

  /**
   * Destroy session
   * @param {string} sessionId - Session ID
   */
  async destroySession(sessionId) {
    try {
      const sessionKey = `${this.SESSION_PREFIX}${sessionId}`;
      await redis.del(sessionKey);
      logger.info(`Session destroyed: ${sessionId}`);
    } catch (error) {
      logger.error('Session destruction failed:', error);
      throw new ApiError(500, 'Session cleanup failed');
    }
  }

  /**
   * Generate secure token ID
   * @returns {string} Unique token ID
   */
  generateTokenId() {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Extract token from Authorization header
   * @param {string} authHeader - Authorization header value
   * @returns {string|null} Extracted token
   */
  extractTokenFromHeader(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

  /**
   * Generate secure session ID for WhatsApp sessions
   * @param {string} userAgent - User agent string
   * @returns {string} Secure session ID
   */
  generateSessionId(userAgent = 'unknown') {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 15);
    const userAgentHash = userAgent.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
    return `wa_${timestamp}_${random}_${userAgentHash}`;
  }
}

export default new AuthService();
