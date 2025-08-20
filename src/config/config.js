import dotenv from 'dotenv';
import path from 'path';
import Joi from 'joi';
import { fileURLToPath } from 'url';

// For __dirname in ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Best Practice: Keep your .env file secure and out of version control.
// This can be done using a .gitignore file to exclude it from Git commits.

// Define validation schema
const envSchema = Joi.object({
    NODE_ENV: Joi.string()
               .valid('development', 'production', 'test')
               .required()
               .description('Node Environment (development, production, test)'),

    PORT: Joi.number()
          .default(3000)
          .description('Port the server runs on'),

    MONGO_URI: Joi.string()
               .uri()
               .required()
               .description('MongoDB connection URI'),

    JWT_SECRET: Joi.string()
                 .required()
                 .description('JWT secret key'),

    REDIS_URL: Joi.string()
                .uri()
                .optional()
                .description('Redis server URL'),

    SOCKET_IO_REDIS_ADAPTER: Joi.boolean()
                            .default(false)
                            .description('Use Redis for Socket.IO adapter'),
}).unknown();

// Best Practice: Add descriptions to all validation parameters for clarity.

// Validate the environment variables
const { value: envVars, error } = envSchema
    .prefs({ errors: { label: 'key' } })
    .validate(process.env);

if (error) {
    throw new Error(` Config validation error: ${error.message}`);
}

// Export the validated and structured config
export default {
    env: envVars.NODE_ENV,
    port: envVars.PORT,

    app: {
        name: 'WhatsApp API',
        version: '2.0.0'
    },

    mongo: {
        uri: envVars.MONGO_URI,
        options: {
            maxPoolSize: 20,
            minPoolSize: 5,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            bufferCommands: false
        }
    },

    jwt: {
        secret: envVars.JWT_SECRET,
        accessTokenExpiry: '15m',
        refreshTokenExpiry: '7d'
    },

    redis: {
        url: envVars.REDIS_URL || null,
        host: envVars.REDIS_HOST || 'localhost',
        port: parseInt(envVars.REDIS_PORT) || 6379,
        password: envVars.REDIS_PASSWORD || null,
        db: parseInt(envVars.REDIS_DB) || 0,
        useForSocketIO: envVars.SOCKET_IO_REDIS_ADAPTER || false,
    },

    security: {
        rateLimitPublic: 100, // requests per 15 minutes
        rateLimitAuth: 20,    // requests per 15 minutes for auth endpoints
        bcryptRounds: 12,
        sessionTimeout: 24 * 60 * 60, // 24 hours in seconds
    },

    whatsapp: {
        maxConcurrentSessions: 50,
        qrExpiryTime: 5 * 60 * 1000,      // 5 minutes
        sessionIdleTime: 15 * 60 * 1000,   // 15 minutes
        maxSessionTime: 2 * 60 * 60 * 1000, // 2 hours
        cleanupInterval: 5 * 60 * 1000      // 5 minutes
    }
};
