import config from '../config/config.js';
import logger from '../utils/logger.js';
import ApiError from '../utils/ApiError.js';

/**
 * Centralized error handling middleware
 * Handles all types of errors and provides consistent API responses
 */
class ErrorHandler {
  /**
   * Convert error to ApiError
   * @param {Error} err - The error to convert
   * @returns {ApiError} Standardized API error
   */
  static convertToApiError(err) {
    let convertedError = err;

    // Convert known error types
    if (err.name === 'ValidationError') {
      // Mongoose validation error
      const errors = Object.values(err.errors).map(e => ({
        field: e.path,
        message: e.message
      }));
      convertedError = ApiError.badRequest('Validation failed', errors);
    } else if (err.name === 'CastError') {
      // Mongoose cast error (invalid ObjectId, etc.)
      convertedError = ApiError.badRequest(`Invalid ${err.path}: ${err.value}`);
    } else if (err.code === 11000) {
      // MongoDB duplicate key error
      const field = Object.keys(err.keyValue)[0];
      convertedError = ApiError.conflict(`Duplicate value for field: ${field}`);
    } else if (err.name === 'JsonWebTokenError') {
      // JWT errors
      convertedError = ApiError.unauthorized('Invalid token');
    } else if (err.name === 'TokenExpiredError') {
      convertedError = ApiError.unauthorized('Token expired');
    } else if (err.name === 'MongoNetworkError') {
      convertedError = ApiError.serviceUnavailable('Database connection error');
    } else if (err.type === 'entity.parse.failed') {
      // JSON parsing error
      convertedError = ApiError.badRequest('Invalid JSON format');
    } else if (err.type === 'entity.too.large') {
      // Request too large
      convertedError = ApiError.badRequest('Request entity too large');
    } else if (!(err instanceof ApiError)) {
      // Generic unhandled errors
      convertedError = ApiError.internal('Something went wrong');
    }

    return convertedError;
  }

  /**
   * Log error with appropriate level
   * @param {Error} error - Error to log
   * @param {Object} req - Express request object
   */
  static logError(error, req = null) {
    const logData = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...(error.statusCode && { statusCode: error.statusCode })
      },
      ...(req && {
        request: {
          id: req.id,
          method: req.method,
          url: req.url,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          body: req.body && Object.keys(req.body).length > 0 ? req.body : undefined,
          params: req.params && Object.keys(req.params).length > 0 ? req.params : undefined,
          query: req.query && Object.keys(req.query).length > 0 ? req.query : undefined,
          user: req.user ? { userId: req.user.userId, sessionId: req.user.sessionId } : undefined
        }
      })
    };

    // Log based on error severity
    if (error instanceof ApiError) {
      if (error.statusCode >= 500) {
        logger.error('Server Error:', logData);
      } else if (error.statusCode >= 400) {
        logger.warn('Client Error:', logData);
      } else {
        logger.info('Request Error:', logData);
      }
    } else {
      logger.error('Unhandled Error:', logData);
    }
  }

  /**
   * Main error handling middleware
   * @param {Error} err - Error object
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  static handleError(err, req, res, next) {
    // Convert error to ApiError
    const apiError = ErrorHandler.convertToApiError(err);

    // Log the error
    ErrorHandler.logError(apiError, req);

    // Don't send error details in production for 5xx errors
    let responseError = apiError.toJSON();
    if (config.env === 'production' && apiError.statusCode >= 500) {
      responseError = {
        status: 'error',
        statusCode: apiError.statusCode,
        message: 'Internal Server Error',
        timestamp: apiError.timestamp
      };
    }

    // Add request ID to response for tracking
    if (req.id) {
      responseError.requestId = req.id;
    }

    res.status(apiError.statusCode).json(responseError);
  }

  /**
   * Handle 404 errors (unmatched routes)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  static handleNotFound(req, res, next) {
    const error = ApiError.notFound(`Route ${req.method} ${req.path} not found`);
    next(error);
  }

  /**
   * Handle uncaught exceptions and unhandled rejections
   */
  static handleUncaughtExceptions() {
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      });

      // Graceful shutdown
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection:', {
        promise,
        reason: reason?.stack || reason
      });

      // Don't exit the process for unhandled rejections in production
      // but log them for monitoring
      if (config.env !== 'production') {
        process.exit(1);
      }
    });
  }

  /**
   * Async error wrapper for route handlers
   * @param {Function} fn - Async route handler
   * @returns {Function} Wrapped handler
   */
  static asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Validation error handler for express-validator
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  static handleValidationErrors(req, res, next) {
    return async (req, res, next) => {
      try {
        const { validationResult } = await import('express-validator');
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
          const validationErrors = errors.array().map(error => ({
            field: error.path || error.param,
            message: error.msg,
            value: error.value
          }));

          const apiError = ApiError.badRequest('Validation failed', validationErrors);
          return next(apiError);
        }

        next();
      } catch (error) {
        logger.error('Validation error handler failed:', error);
        next();
      }
    };
  }

  /**
   * CORS error handler
   * @param {Error} err - CORS error
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  static handleCorsError(err, req, res, next) {
    if (err.message === 'Not allowed by CORS') {
      const corsError = ApiError.forbidden('CORS: Origin not allowed');
      return next(corsError);
    }
    next(err);
  }

  /**
   * Rate limit error handler
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static handleRateLimitError(req, res) {
    const error = ApiError.tooManyRequests('Too many requests from this IP');
    ErrorHandler.logError(error, req);
    res.status(error.statusCode).json(error.toJSON());
  }

  /**
   * Socket.IO error handler
   * @param {Error} error - Socket error
   * @param {Object} socket - Socket.IO socket
   */
  static handleSocketError(error, socket) {
    logger.error('Socket.IO Error:', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      socket: {
        id: socket.id,
        rooms: Array.from(socket.rooms),
        handshake: socket.handshake?.address
      }
    });

    // Emit error to client
    socket.emit('error', {
      status: 'error',
      message: 'Socket connection error',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Database connection error handler
   * @param {Error} error - Database error
   */
  static handleDatabaseError(error) {
    logger.error('Database Connection Error:', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code
      }
    });

    // Implement reconnection logic or graceful degradation
    if (error.name === 'MongoNetworkError' || error.name === 'MongoTimeoutError') {
      // Log and potentially trigger reconnection
      logger.warn('Database reconnection may be needed');
    }
  }

  /**
   * Redis error handler
   * @param {Error} error - Redis error
   */
  static handleRedisError(error) {
    logger.error('Redis Error:', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code
      }
    });

    // Don't throw on Redis errors, log and continue
    logger.warn('Continuing without Redis functionality');
  }
}

// Initialize uncaught exception handling
ErrorHandler.handleUncaughtExceptions();

export default ErrorHandler;
