import Redis from 'ioredis';
import config from './config.js';
import logger from '../utils/logger.js';

/**
 * Redis configuration and connection management
 * Handles connection, reconnection, and error handling
 */
class RedisManager {
  constructor() {
    this.redis = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000; // Start with 1 second
  }

  /**
   * Initialize Redis connection with retry logic
   */
  async connect() {
    try {
      if (this.redis && this.isConnected) {
        return this.redis;
      }

      const redisConfig = {
        host: config.redis.host || 'localhost',
        port: config.redis.port || 6379,
        password: config.redis.password || undefined,
        db: config.redis.db || 0,
        
        // Connection settings
        connectTimeout: 10000,
        commandTimeout: 5000,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        
        // Retry strategy with limited attempts
        retryDelayOnConnect: (times) => {
          if (times > 3) {
            logger.warn('Redis connection failed after 3 attempts, using in-memory fallback');
            return null; // Stop retrying
          }
          const delay = Math.min(times * 1000, 3000);
          logger.warn(`Redis connection retry ${times}, delay: ${delay}ms`);
          return delay;
        },
        
        // Health check
        keepAlive: 30000,
        
        // Event handlers
        lazyConnect: true,
      };

      // Parse Redis URL if provided
      if (config.redis.url) {
        this.redis = new Redis(config.redis.url, redisConfig);
      } else {
        this.redis = new Redis(redisConfig);
      }

      // Connection event handlers
      this.redis.on('connect', () => {
        logger.info('Redis connecting...');
      });

      this.redis.on('ready', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        logger.info('Redis connection ready');
      });

      this.redis.on('error', (error) => {
        this.isConnected = false;
        logger.error('Redis connection error:', error);
        
        if (error.code === 'ECONNREFUSED') {
          logger.error('Redis server is not running or not accessible');
        }
      });

      this.redis.on('close', () => {
        this.isConnected = false;
        logger.warn('Redis connection closed');
      });

      this.redis.on('reconnecting', (times) => {
        this.reconnectAttempts = times;
        logger.info(`Redis reconnecting attempt ${times}`);
      });

      // Attempt initial connection
      await this.redis.connect();
      
      // Test connection
      await this.redis.ping();
      logger.info('Redis connection established and tested');

      return this.redis;
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      
      // Fallback to in-memory storage in development
      if (config.env === 'development') {
        logger.warn('Using in-memory fallback for Redis operations');
        return this.createMemoryFallback();
      }
      
      throw error;
    }
  }

  /**
   * Create in-memory fallback for development
   */
  createMemoryFallback() {
    const memoryStore = new Map();
    const timers = new Map();

    return {
      // Basic Redis operations
      async get(key) {
        return memoryStore.get(key) || null;
      },
      
      async set(key, value) {
        memoryStore.set(key, value);
        return 'OK';
      },
      
      async setex(key, seconds, value) {
        memoryStore.set(key, value);
        
        // Clear existing timer
        if (timers.has(key)) {
          clearTimeout(timers.get(key));
        }
        
        // Set expiration timer
        const timer = setTimeout(() => {
          memoryStore.delete(key);
          timers.delete(key);
        }, seconds * 1000);
        
        timers.set(key, timer);
        return 'OK';
      },
      
      async del(key) {
        const existed = memoryStore.has(key);
        memoryStore.delete(key);
        
        if (timers.has(key)) {
          clearTimeout(timers.get(key));
          timers.delete(key);
        }
        
        return existed ? 1 : 0;
      },
      
      async exists(key) {
        return memoryStore.has(key) ? 1 : 0;
      },
      
      async ttl(key) {
        return memoryStore.has(key) ? -1 : -2;
      },
      
      async ping() {
        return 'PONG';
      },
      
      async keys(pattern) {
        if (pattern === '*') {
          return Array.from(memoryStore.keys());
        }
        
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return Array.from(memoryStore.keys()).filter(key => regex.test(key));
      },
      
      async flushall() {
        memoryStore.clear();
        timers.forEach(timer => clearTimeout(timer));
        timers.clear();
        return 'OK';
      }
    };
  }

  /**
   * Get Redis instance
   */
  getInstance() {
    if (!this.redis) {
      throw new Error('Redis not initialized. Call connect() first.');
    }
    return this.redis;
  }

  /**
   * Check if Redis is connected
   */
  isReady() {
    return this.isConnected;
  }

  /**
   * Graceful shutdown
   */
  async disconnect() {
    if (this.redis && this.isConnected) {
      logger.info('Disconnecting from Redis...');
      await this.redis.quit();
      this.isConnected = false;
      logger.info('Redis disconnected');
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.redis) {
        return { status: 'error', message: 'Redis not initialized' };
      }

      const start = Date.now();
      await this.redis.ping();
      const responseTime = Date.now() - start;

      return {
        status: 'healthy',
        responseTime: `${responseTime}ms`,
        connected: this.isConnected,
        host: config.redis.host || 'localhost',
        port: config.redis.port || 6379
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
        connected: false
      };
    }
  }

  /**
   * Get Redis statistics
   */
  async getStats() {
    try {
      if (!this.redis || !this.isConnected) {
        return { error: 'Redis not connected' };
      }

      const info = await this.redis.info();
      const memoryInfo = info.split('\r\n')
        .filter(line => line.includes('used_memory_human') || line.includes('connected_clients'))
        .reduce((acc, line) => {
          const [key, value] = line.split(':');
          acc[key] = value;
          return acc;
        }, {});

      return {
        connected: this.isConnected,
        memory: memoryInfo,
        reconnectAttempts: this.reconnectAttempts
      };
    } catch (error) {
      return { error: error.message };
    }
  }
}

// Create singleton instance
const redisManager = new RedisManager();

// Initialize connection
let redis = null;

const initializeRedis = async () => {
  try {
    redis = await redisManager.connect();
    return redis;
  } catch (error) {
    logger.error('Redis initialization failed:', error);
    throw error;
  }
};

// Don't auto-initialize Redis - let the application control when to connect
// This prevents uncaught exceptions during module loading

export { redis, redisManager, initializeRedis };
export default redisManager;
