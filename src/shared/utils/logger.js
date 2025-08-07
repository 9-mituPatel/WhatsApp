import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Custom log format for structured logging
 */
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

/**
 * Console format for development
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.colorize(),
  winston.format.printf((info) => {
    const { timestamp, level, message, service, requestId, sessionId, ...meta } = info;
    
    let logMessage = `[${timestamp}] ${level}: ${message}`;
    
    if (service) logMessage += ` [${service}]`;
    if (requestId) logMessage += ` [req:${requestId}]`;
    if (sessionId) logMessage += ` [session:${sessionId}]`;
    
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta, null, 2)}`;
    }
    
    return logMessage;
  })
);

/**
 * Winston logger configuration
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: {
    service: 'whatsapp-api',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Error logs
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: customFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      handleExceptions: true,
      handleRejections: true
    }),

    // Combined logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: customFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),

    // Access logs
    new winston.transports.File({
      filename: path.join(logsDir, 'access.log'),
      level: 'http',
      format: customFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 3
    })
  ]
});

// Add console transport for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    handleExceptions: true,
    handleRejections: true
  }));
}

// Add trace method for Baileys compatibility
logger.trace = (...args) => {
  logger.debug(...args);
};

/**
 * Logger utility functions
 */
export const createChildLogger = (context = {}) => {
  return logger.child(context);
};

export const httpLogger = (req, res, next) => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || Math.random().toString(36).substr(2, 9);
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);
  res.locals.requestId = requestId;
  
  // Log request
  logger.http('HTTP Request', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId
  });
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.http('HTTP Response', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      requestId
    });
  });
  
  next();
};

/**
 * Structured logging helpers
 */
export const loggers = {
  auth: createChildLogger({ service: 'auth' }),
  session: createChildLogger({ service: 'session' }),
  message: createChildLogger({ service: 'message' }),
  webhook: createChildLogger({ service: 'webhook' }),
  provider: createChildLogger({ service: 'provider' }),
  database: createChildLogger({ service: 'database' }),
  api: createChildLogger({ service: 'api' })
};

// Stream for morgan HTTP logger compatibility
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

export default logger;
