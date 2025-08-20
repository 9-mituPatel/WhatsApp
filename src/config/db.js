import mongoose from 'mongoose';
import config from './config.js';
import logger from '../utils/logger.js';

// Define connection options (updated for Mongoose 8+)
const options = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4, // Use IPv4, skip trying IPv6
  maxPoolSize: config.mongo.options?.maxPoolSize || 20,
  minPoolSize: config.mongo.options?.minPoolSize || 5,
  maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
  connectTimeoutMS: 10000, // Give up initial connection after 10 seconds
  bufferCommands: config.mongo.options?.bufferCommands ?? false,
  // Removed deprecated options that are now defaults in Mongoose 8+
};

// Asynchronous function to connect to MongoDB
export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongo.uri, options);
    logger.info(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error('❌ MongoDB connection error:', error);
    process.exit(1); // Exit process with failure
  }

  mongoose.connection.on('connected', () => {
    logger.info('✅ Mongoose connected to DB cluster');
  });

  mongoose.connection.on('error', err => {
    logger.error(`❌ Mongoose connection error: ${err}`);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('⚠️ Mongoose disconnected');
  });

  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    logger.info('🔌 Mongoose connection closed due to app termination');
    process.exit(0);
  });
};
