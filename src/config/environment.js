import dotenv from 'dotenv';
import path from 'path';
import Joi from 'joi';
import { fileURLToPath } from 'url';

// For __dirname in ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Environment Configuration Schema
 * Validates all required environment variables
 */
const envSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'staging')
    .required()
    .description('Node Environment'),

  PORT: Joi.number()
    .default(3000)
    .description('Server port number'),

  API_VERSION: Joi.string()
    .default('v1')
    .description('API version'),

  APP_NAME: Joi.string()
    .default('WhatsApp API')
    .description('Application name'),

  // Database
  MONGO_URI: Joi.string()
    .uri()
    .required()
    .description('MongoDB connection URI'),

  MONGO_DB_NAME: Joi.string()
    .default('whatsapp_api')
    .description('MongoDB database name'),

  // Redis (optional)
  REDIS_URL: Joi.string()
    .uri()
    .optional()
    .description('Redis server URL'),

  REDIS_PASSWORD: Joi.string()
    .optional()
    .description('Redis password'),

  REDIS_DB: Joi.number()
    .default(0)
    .description('Redis database number'),

  // Authentication
  JWT_SECRET: Joi.string()
    .min(32)
    .required()
    .description('JWT secret key'),

  JWT_EXPIRES_IN: Joi.string()
    .default('7d')
    .description('JWT expiration time'),

  JWT_REFRESH_SECRET: Joi.string()
    .min(32)
    .optional()
    .description('JWT refresh token secret'),

  JWT_REFRESH_EXPIRES_IN: Joi.string()
    .default('30d')
    .description('JWT refresh token expiration'),

  // Encryption
  ENCRYPTION_KEY: Joi.string()
    .length(32)
    .optional()
    .description('Data encryption key'),

  BCRYPT_ROUNDS: Joi.number()
    .default(12)
    .description('BCrypt hash rounds'),

  // WhatsApp Provider Settings
  WHATSAPP_PROVIDER: Joi.string()
    .valid('baileys', 'whatsapp-cloud', 'twilio')
    .default('baileys')
    .description('WhatsApp provider to use'),

  // WhatsApp Cloud API (Meta)
  WHATSAPP_CLOUD_TOKEN: Joi.string()
    .optional()
    .description('WhatsApp Cloud API access token'),

  WHATSAPP_CLOUD_PHONE_ID: Joi.string()
    .optional()
    .description('WhatsApp Cloud API phone number ID'),

  WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN: Joi.string()
    .optional()
    .description('WhatsApp Cloud webhook verification token'),

  WHATSAPP_CLOUD_BUSINESS_ID: Joi.string()
    .optional()
    .description('WhatsApp Business account ID'),

  // Twilio
  TWILIO_ACCOUNT_SID: Joi.string()
    .optional()
    .description('Twilio account SID'),

  TWILIO_AUTH_TOKEN: Joi.string()
    .optional()
    .description('Twilio auth token'),

  TWILIO_WHATSAPP_NUMBER: Joi.string()
    .optional()
    .description('Twilio WhatsApp number'),

  // Session Management
  MAX_SESSIONS: Joi.number()
    .default(100)
    .description('Maximum concurrent sessions'),

  SESSION_TIMEOUT: Joi.number()
    .default(1800000) // 30 minutes
    .description('Session timeout in milliseconds'),

  QR_TIMEOUT: Joi.number()
    .default(300000) // 5 minutes
    .description('QR code timeout in milliseconds'),

  // Rate Limiting
  RATE_LIMIT_WINDOW: Joi.number()
    .default(900000) // 15 minutes
    .description('Rate limit window in milliseconds'),

  RATE_LIMIT_MAX: Joi.number()
    .default(100)
    .description('Maximum requests per window'),

  // File Upload
  MAX_FILE_SIZE: Joi.number()
    .default(104857600) // 100MB
    .description('Maximum file upload size in bytes'),

  UPLOAD_PATH: Joi.string()
    .default('./uploads')
    .description('File upload directory'),

  // Storage
  STORAGE_PROVIDER: Joi.string()
    .valid('local', 's3', 'cloudinary')
    .default('local')
    .description('Storage provider for media files'),

  // AWS S3
  AWS_ACCESS_KEY_ID: Joi.string()
    .optional()
    .description('AWS access key ID'),

  AWS_SECRET_ACCESS_KEY: Joi.string()
    .optional()
    .description('AWS secret access key'),

  AWS_REGION: Joi.string()
    .default('us-east-1')
    .description('AWS region'),

  AWS_S3_BUCKET: Joi.string()
    .optional()
    .description('AWS S3 bucket name'),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: Joi.string()
    .optional()
    .description('Cloudinary cloud name'),

  CLOUDINARY_API_KEY: Joi.string()
    .optional()
    .description('Cloudinary API key'),

  CLOUDINARY_API_SECRET: Joi.string()
    .optional()
    .description('Cloudinary API secret'),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly')
    .default('info')
    .description('Logging level'),

  LOG_TO_FILE: Joi.boolean()
    .default(true)
    .description('Enable file logging'),

  // CORS
  CORS_ORIGIN: Joi.alternatives()
    .try(
      Joi.string(),
      Joi.array().items(Joi.string())
    )
    .default('*')
    .description('CORS allowed origins'),

  // Security
  HELMET_ENABLED: Joi.boolean()
    .default(true)
    .description('Enable Helmet security headers'),

  TRUST_PROXY: Joi.boolean()
    .default(false)
    .description('Trust proxy headers'),

  // Development
  SWAGGER_ENABLED: Joi.boolean()
    .default(true)
    .description('Enable Swagger documentation'),

  DEBUG_ENABLED: Joi.boolean()
    .default(false)
    .description('Enable debug mode'),

  // Health Check
  HEALTH_CHECK_INTERVAL: Joi.number()
    .default(60000) // 1 minute
    .description('Health check interval in milliseconds'),

  // Webhook
  WEBHOOK_MAX_RETRIES: Joi.number()
    .default(3)
    .description('Maximum webhook retry attempts'),

  WEBHOOK_RETRY_DELAY: Joi.number()
    .default(5000)
    .description('Webhook retry delay in milliseconds'),

}).unknown();

// Validate environment variables
const { value: envVars, error } = envSchema
  .prefs({ errors: { label: 'key' } })
  .validate(process.env);

if (error) {
  throw new Error(`❌ Config validation error: ${error.message}`);
}

/**
 * Environment Configuration Object
 */
const config = {
  // Application
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  apiVersion: envVars.API_VERSION,
  appName: envVars.APP_NAME,

  // Database
  database: {
    uri: envVars.MONGO_URI,
    name: envVars.MONGO_DB_NAME,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }
  },

  // Redis
  redis: {
    url: envVars.REDIS_URL,
    password: envVars.REDIS_PASSWORD,
    db: envVars.REDIS_DB,
    enabled: !!envVars.REDIS_URL
  },

  // Authentication
  auth: {
    jwt: {
      secret: envVars.JWT_SECRET,
      expiresIn: envVars.JWT_EXPIRES_IN,
      refreshSecret: envVars.JWT_REFRESH_SECRET,
      refreshExpiresIn: envVars.JWT_REFRESH_EXPIRES_IN
    },
    bcryptRounds: envVars.BCRYPT_ROUNDS
  },

  // Encryption
  encryption: {
    key: envVars.ENCRYPTION_KEY
  },

  // WhatsApp Provider Configuration
  whatsapp: {
    provider: envVars.WHATSAPP_PROVIDER,
    
    // Cloud API (Meta)
    cloud: {
      token: envVars.WHATSAPP_CLOUD_TOKEN,
      phoneId: envVars.WHATSAPP_CLOUD_PHONE_ID,
      webhookVerifyToken: envVars.WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN,
      businessId: envVars.WHATSAPP_CLOUD_BUSINESS_ID
    },

    // Twilio
    twilio: {
      accountSid: envVars.TWILIO_ACCOUNT_SID,
      authToken: envVars.TWILIO_AUTH_TOKEN,
      whatsappNumber: envVars.TWILIO_WHATSAPP_NUMBER
    },

    // Session settings
    sessions: {
      max: envVars.MAX_SESSIONS,
      timeout: envVars.SESSION_TIMEOUT,
      qrTimeout: envVars.QR_TIMEOUT
    }
  },

  // Rate Limiting
  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW,
    max: envVars.RATE_LIMIT_MAX
  },

  // File Upload
  upload: {
    maxFileSize: envVars.MAX_FILE_SIZE,
    path: envVars.UPLOAD_PATH
  },

  // Storage
  storage: {
    provider: envVars.STORAGE_PROVIDER,
    
    s3: {
      accessKeyId: envVars.AWS_ACCESS_KEY_ID,
      secretAccessKey: envVars.AWS_SECRET_ACCESS_KEY,
      region: envVars.AWS_REGION,
      bucket: envVars.AWS_S3_BUCKET
    },

    cloudinary: {
      cloudName: envVars.CLOUDINARY_CLOUD_NAME,
      apiKey: envVars.CLOUDINARY_API_KEY,
      apiSecret: envVars.CLOUDINARY_API_SECRET
    }
  },

  // Logging
  logging: {
    level: envVars.LOG_LEVEL,
    toFile: envVars.LOG_TO_FILE
  },

  // CORS
  cors: {
    origin: envVars.CORS_ORIGIN
  },

  // Security
  security: {
    helmet: envVars.HELMET_ENABLED,
    trustProxy: envVars.TRUST_PROXY
  },

  // Development
  development: {
    swagger: envVars.SWAGGER_ENABLED,
    debug: envVars.DEBUG_ENABLED
  },

  // Health Check
  healthCheck: {
    interval: envVars.HEALTH_CHECK_INTERVAL
  },

  // Webhook
  webhook: {
    maxRetries: envVars.WEBHOOK_MAX_RETRIES,
    retryDelay: envVars.WEBHOOK_RETRY_DELAY
  }
};

// Environment specific settings
if (config.env === 'production') {
  config.logging.level = 'warn';
  config.development.debug = false;
}

if (config.env === 'test') {
  config.database.name = `${config.database.name}_test`;
  config.logging.level = 'error';
}

/**
 * Utility functions
 */
export const isProduction = () => config.env === 'production';
export const isDevelopment = () => config.env === 'development';
export const isTest = () => config.env === 'test';

export default config;
