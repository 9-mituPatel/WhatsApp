import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';
import compression from 'compression';
import morgan from 'morgan';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import AuthService from '../services/AuthService.js';
import ApiError from '../utils/ApiError.js';

/**
 * Security middleware configuration
 */
class SecurityMiddleware {
  constructor() {
    this.trustedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001'
    ];

    // Add production origins from environment
    if (process.env.TRUSTED_ORIGINS) {
      this.trustedOrigins.push(...process.env.TRUSTED_ORIGINS.split(','));
    }
  }

  /**
   * Helmet security headers
   */
  helmet() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false, // Disable for WebSocket compatibility
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      noSniff: true,
      frameguard: { action: 'deny' },
      xssFilter: true
    });
  }

  /**
   * CORS configuration with dynamic origin validation
   */
  cors() {
    return cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);

        if (this.trustedOrigins.includes(origin)) {
          return callback(null, true);
        }

        // In production, be more strict
        if (config.env === 'production') {
          logger.warn(`Blocked CORS request from untrusted origin: ${origin}`);
          return callback(new Error('Not allowed by CORS'));
        }

        // In development, allow localhost variations
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
          return callback(null, true);
        }

        logger.warn(`Blocked CORS request from origin: ${origin}`);
        return callback(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Session-ID'
      ],
      credentials: true,
      maxAge: 86400 // 24 hours
    });
  }

  /**
   * Rate limiting configuration
   */
  rateLimiter(options = {}) {
    const defaultOptions = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: config.security.rateLimitPublic,
      message: {
        error: 'Too many requests from this IP, please try again later',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path
        });
        
        res.status(429).json({
          status: 'error',
          message: 'Too many requests from this IP, please try again later',
          retryAfter: Math.ceil(options.windowMs / 1000)
        });
      },
      skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/api/health';
      }
    };

    return rateLimit({ ...defaultOptions, ...options });
  }

  /**
   * Auth endpoints rate limiter (more restrictive)
   */
  authRateLimiter() {
    return this.rateLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: config.security.rateLimitAuth,
      message: {
        error: 'Too many authentication attempts, please try again later',
        retryAfter: '15 minutes'
      }
    });
  }

  /**
   * MongoDB injection protection
   */
  mongoSanitize() {
    return mongoSanitize({
      onSanitize: ({ req, key }) => {
        logger.warn(`Potential MongoDB injection attempt detected`, {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          key,
          body: req.body
        });
      }
    });
  }

  /**
   * XSS protection
   */
  xssClean() {
    return xss();
  }

  /**
   * HTTP Parameter Pollution protection
   */
  hpp() {
    return hpp({
      whitelist: ['sort', 'fields'] // Allow arrays for these parameters
    });
  }

  /**
   * Response compression
   */
  compression() {
    return compression({
      level: 6,
      threshold: 100 * 1024, // Only compress responses > 100KB
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      }
    });
  }

  /**
   * HTTP request logging
   */
  httpLogger() {
    const format = config.env === 'production' 
      ? 'combined' 
      : ':method :url :status :res[content-length] - :response-time ms';

    return morgan(format, {
      stream: {
        write: (message) => {
          logger.info(message.trim(), { type: 'http' });
        }
      },
      skip: (req) => {
        // Skip logging for health checks and static files
        return req.path === '/api/health' || req.path.startsWith('/static/');
      }
    });
  }

  /**
   * Authentication middleware
   */
  authenticate() {
    return async (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        const token = AuthService.extractTokenFromHeader(authHeader);

        if (!token) {
          throw ApiError.unauthorized('Access token required');
        }

        const decoded = await AuthService.verifyAccessToken(token);
        
        // Attach user info to request
        req.user = {
          userId: decoded.userId,
          sessionId: decoded.sessionId,
          tokenId: decoded.tokenId
        };

        // Update session activity
        await AuthService.updateSessionActivity(decoded.sessionId);

        next();
      } catch (error) {
        if (error instanceof ApiError) {
          return res.status(error.statusCode).json(error.toJSON());
        }
        
        logger.error('Authentication middleware error:', error);
        return res.status(401).json({
          status: 'error',
          message: 'Authentication failed'
        });
      }
    };
  }

  /**
   * Optional authentication (doesn't fail if no token)
   */
  optionalAuth() {
    return async (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        const token = AuthService.extractTokenFromHeader(authHeader);

        if (token) {
          const decoded = await AuthService.verifyAccessToken(token);
          req.user = {
            userId: decoded.userId,
            sessionId: decoded.sessionId,
            tokenId: decoded.tokenId
          };
          
          await AuthService.updateSessionActivity(decoded.sessionId);
        }

        next();
      } catch (error) {
        // Continue without authentication for optional auth
        logger.debug('Optional auth failed, continuing without auth:', error.message);
        next();
      }
    };
  }

  /**
   * Session validation middleware
   */
  validateSession() {
    return async (req, res, next) => {
      try {
        const sessionId = req.params.sessionId || req.body.sessionId || req.headers['x-session-id'];

        if (!sessionId) {
          throw ApiError.badRequest('Session ID is required');
        }

        // Validate session format
        if (!sessionId.match(/^wa_\d+_[a-z0-9]+_[a-z0-9]+$/i)) {
          throw ApiError.badRequest('Invalid session ID format');
        }

        req.sessionId = sessionId;
        next();
      } catch (error) {
        if (error instanceof ApiError) {
          return res.status(error.statusCode).json(error.toJSON());
        }
        
        return res.status(400).json({
          status: 'error',
          message: 'Session validation failed'
        });
      }
    };
  }

  /**
   * Request ID middleware for tracing
   */
  requestId() {
    return (req, res, next) => {
      req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      res.setHeader('X-Request-ID', req.id);
      next();
    };
  }

  /**
   * Request size limiter
   */
  requestSizeLimit() {
    return (req, res, next) => {
      const contentLength = parseInt(req.headers['content-length']) || 0;
      const maxSize = 10 * 1024 * 1024; // 10MB

      if (contentLength > maxSize) {
        return res.status(413).json({
          status: 'error',
          message: 'Request entity too large',
          maxSize: '10MB'
        });
      }

      next();
    };
  }

  /**
   * API version middleware
   */
  apiVersion() {
    return (req, res, next) => {
      res.setHeader('X-API-Version', config.app.version);
      next();
    };
  }

  /**
   * Get all security middlewares in order
   */
  getAllMiddlewares() {
    return [
      this.requestId(),
      this.httpLogger(),
      this.helmet(),
      this.cors(),
      this.rateLimiter(),
      this.compression(),
      this.mongoSanitize(),
      this.xssClean(),
      this.hpp(),
      this.requestSizeLimit(),
      this.apiVersion()
    ];
  }

  /**
   * Get auth-specific middlewares
   */
  getAuthMiddlewares() {
    return [
      this.authRateLimiter(),
      this.validateSession()
    ];
  }
}

export default new SecurityMiddleware();
