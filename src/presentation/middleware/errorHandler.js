import { AppError, ValidationError, BusinessError } from '../../core/errors/index.js';
import ApiResponse from '../../shared/utils/response.js';
import { HTTP_STATUS } from '../../core/constants/statusCodes.js';
import logger from '../../shared/utils/logger.js';

/**
 * Global Error Handling Middleware
 * Centralized error processing and response formatting
 */

/**
 * Development error response with full stack trace
 */
const sendErrorDev = (err, res) => {
  const errorResponse = ApiResponse.error(
    err.message,
    err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR,
    {
      stack: err.stack,
      name: err.name,
      code: err.code || err.errorCode,
      ...(err.context && { context: err.context }),
      ...(err.details && { details: err.details })
    },
    {
      environment: 'development'
    }
  );

  errorResponse.send(res);
};

/**
 * Production error response without sensitive information
 */
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (AppError.isOperational(err)) {
    const errorResponse = ApiResponse.error(
      err.message,
      err.statusCode,
      null,
      {
        code: err.errorCode,
        timestamp: err.timestamp
      }
    );
    
    errorResponse.send(res);
  } else {
    // Programming or other unknown error: don't leak error details
    logger.error('UNKNOWN ERROR:', err);
    
    const errorResponse = ApiResponse.internalError(
      'Something went wrong!',
      {
        requestId: res.locals.requestId
      }
    );
    
    errorResponse.send(res);
  }
};

/**
 * Handle MongoDB duplicate key errors
 */
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  
  return new ValidationError(
    `${field} '${value}' already exists`,
    [{
      field,
      message: `${field} must be unique`,
      value,
      type: 'unique'
    }],
    field
  );
};

/**
 * Handle MongoDB validation errors
 */
const handleValidationError = (err) => {
  const details = Object.values(err.errors).map(val => ({
    field: val.path,
    message: val.message,
    value: val.value,
    type: val.kind
  }));

  return new ValidationError('Invalid input data', details);
};

/**
 * Handle MongoDB cast errors
 */
const handleCastError = (err) => {
  return new ValidationError(
    `Invalid ${err.path}: ${err.value}`,
    [{
      field: err.path,
      message: `Invalid ${err.path}`,
      value: err.value,
      type: 'cast'
    }],
    err.path
  );
};

/**
 * Handle JWT errors
 */
const handleJWTError = () => {
  return BusinessError.invalidCredentials();
};

/**
 * Handle JWT expired errors
 */
const handleJWTExpiredError = () => {
  return BusinessError.tokenExpired();
};

/**
 * Handle Multer errors (file upload)
 */
const handleMulterError = (err) => {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return BusinessError.mediaSizeExceeded(err.field, 'File size limit exceeded');
    case 'LIMIT_FILE_COUNT':
      return new ValidationError('Too many files uploaded');
    case 'LIMIT_UNEXPECTED_FILE':
      return new ValidationError('Unexpected file field');
    default:
      return new ValidationError(`File upload error: ${err.message}`);
  }
};

/**
 * Handle Baileys/WhatsApp errors
 */
const handleBaileysError = (err) => {
  if (err.output) {
    return BusinessError.providerError('baileys', err.output.payload?.message || err.message);
  }
  return BusinessError.providerError('baileys', err.message);
};

/**
 * Log error details
 */
const logError = (err, req) => {
  const errorLog = {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    requestId: res.locals.requestId,
    userId: req.user?.id,
    sessionId: req.params?.sessionId
  };

  if (AppError.isOperational(err)) {
    logger.warn('Operational Error:', errorLog);
  } else {
    logger.error('System Error:', errorLog);
  }
};

/**
 * Main error handling middleware
 */
export const globalErrorHandler = (err, req, res, next) => {
  // Set default status code and message
  err.statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  err.status = err.status || 'error';

  // Log the error
  logError(err, req);

  // Transform known errors
  let error = { ...err };
  error.message = err.message;

  // MongoDB duplicate key error
  if (err.code === 11000) {
    error = handleDuplicateKeyError(err);
  }

  // MongoDB validation error
  if (err.name === 'ValidationError') {
    error = handleValidationError(err);
  }

  // MongoDB cast error
  if (err.name === 'CastError') {
    error = handleCastError(err);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  }

  if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  }

  // Multer errors
  if (err.name === 'MulterError') {
    error = handleMulterError(err);
  }

  // Baileys errors
  if (err.name === 'DisconnectReason' || err.output) {
    error = handleBaileysError(err);
  }

  // Send error response based on environment
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

/**
 * Handle unhandled routes (404)
 */
export const notFoundHandler = (req, res, next) => {
  const error = new AppError(
    `Can't find ${req.originalUrl} on this server!`,
    HTTP_STATUS.NOT_FOUND,
    'NOT_FOUND'
  );
  
  next(error);
};

/**
 * Handle async errors in routes
 */
export const asyncErrorHandler = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

/**
 * Graceful shutdown on uncaught exceptions
 */
export const handleUncaughtException = () => {
  process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
    logger.error(err.name, err.message, err.stack);
    
    process.exit(1);
  });
};

/**
 * Graceful shutdown on unhandled rejections
 */
export const handleUnhandledRejection = (server) => {
  process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
    logger.error(err.name, err.message, err.stack);
    
    server.close(() => {
      process.exit(1);
    });
  });
};

export default {
  globalErrorHandler,
  notFoundHandler,
  asyncErrorHandler,
  handleUncaughtException,
  handleUnhandledRejection
};
