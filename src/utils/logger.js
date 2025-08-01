// utils/logger.js

import { createLogger, format, transports } from 'winston';
import fs from 'fs';
import path from 'path';

// Define the log directory
const logDir = './logs';

// Ensure the log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Define the custom log format
const customFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD hh:mm:ss A' }),
  format.errors({ stack: true }),
  format.splat(),
  format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
  })
);

// Create the logger
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.json(),
    customFormat
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        customFormat
      ),
    }),
    new transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error' 
    }),
    new transports.File({ 
      filename: path.join(logDir, 'combined.log') 
    })
  ],
  exceptionHandlers: [
    new transports.File({ 
      filename: path.join(logDir, 'exceptions.log')
    })
  ],
  rejectionHandlers: [
    new transports.File({ 
      filename: path.join(logDir, 'rejections.log')
    })
  ],
  exitOnError: false,
});

// Stream for morgan HTTP logger
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

// Add trace method for Baileys compatibility
logger.trace = (...args) => {
  // Map trace to debug level since winston doesn't have trace by default
  logger.debug(...args);
};

// Set debug level if not already set
if (logger.level === 'info') {
  logger.level = 'debug';
}

export default logger;
