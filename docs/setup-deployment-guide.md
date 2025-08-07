# Setup & Deployment Guide

## Table of Contents
- [System Requirements](#system-requirements)
- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
- [Production Deployment](#production-deployment)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Security Configuration](#security-configuration)
- [Monitoring & Logging](#monitoring--logging)
- [Troubleshooting](#troubleshooting)
- [Performance Tuning](#performance-tuning)
- [Backup & Recovery](#backup--recovery)

## System Requirements

### Minimum Requirements
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Memory**: 256MB RAM
- **Storage**: 1GB free space
- **Network**: Stable internet connection
- **OS**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 20.04+)

### Recommended Requirements
- **Node.js**: v20.0.0 or higher
- **npm**: v10.0.0 or higher
- **Memory**: 512MB RAM
- **Storage**: 5GB free space
- **Database**: MongoDB v6.0+ or MongoDB Atlas
- **Cache**: Redis v6.0+ (optional)
- **OS**: Latest stable versions

### Dependencies
```json
{
  "node": ">=18.0.0",
  "npm": ">=9.0.0",
  "mongodb": ">=4.4.0",
  "redis": ">=6.0.0 (optional)"
}
```

## Quick Start

### 1. Clone and Install
```bash
# Clone the repository
git clone <repository-url>
cd whatsapp-api

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Start development server
npm run dev
```

### 2. Basic Configuration
Edit `.env` file with your settings:
```bash
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://localhost:27017/whatsapp_api
JWT_SECRET=your_jwt_secret_key_here
```

### 3. Start Application
```bash
# Development mode
npm run dev

# Production mode
npm start
```

### 4. Verify Installation
```bash
# Check server status
curl http://localhost:3000/api/health

# Expected response
{
  "status": "OK",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "service": "WhatsApp API Server"
}
```

## Development Setup

### 1. Prerequisites Installation

#### Node.js Installation
```bash
# Using Node Version Manager (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
nvm install 20
nvm use 20

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show v10.x.x
```

#### MongoDB Installation

**Local Installation (Ubuntu)**:
```bash
# Import MongoDB GPG key
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Install MongoDB
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB service
sudo systemctl start mongod
sudo systemctl enable mongod
```

**Using Docker**:
```bash
# Run MongoDB container
docker run --name mongodb -d -p 27017:27017 mongo:6.0

# Verify connection
mongosh --eval "db.adminCommand('ismaster')"
```

**MongoDB Atlas (Cloud)**:
1. Sign up at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a new cluster
3. Get connection string
4. Update `.env` with Atlas connection string

### 2. Project Setup

#### Environment Configuration
```bash
# Create environment file
cp .env.example .env

# Edit with your preferred editor
nano .env
# or
code .env
```

#### Environment Variables
```bash
# Application
NODE_ENV=development
PORT=3000

# Database
MONGO_URI=mongodb://localhost:27017/whatsapp_api

# Security
JWT_SECRET=your_very_long_and_secure_jwt_secret_key_here_min_32_chars

# Redis (Optional)
REDIS_URL=redis://localhost:6379
SOCKET_IO_REDIS_ADAPTER=false

# Logging
LOG_LEVEL=debug
```

#### Install Dependencies
```bash
# Install all dependencies
npm install

# Install development dependencies
npm install --save-dev nodemon

# Verify installation
npm list
```

### 3. Database Initialization

#### MongoDB Setup
```javascript
// Create initial database connection test
// test-db-connection.js
import mongoose from 'mongoose';

const testConnection = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/whatsapp_api');
    console.log('✅ MongoDB connection successful');
    
    // Test basic operations
    const testCollection = mongoose.connection.db.collection('test');
    await testCollection.insertOne({ test: 'data' });
    await testCollection.deleteOne({ test: 'data' });
    
    console.log('✅ Database operations working');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
};

testConnection();
```

Run the test:
```bash
node test-db-connection.js
```

### 4. Development Server

#### Start Development Server
```bash
# With nodemon (auto-restart)
npm run dev

# With regular node
npm start

# With debug logging
DEBUG=* npm run dev
```

#### Development Scripts
```json
{
  "scripts": {
    "dev": "nodemon --exec \"node --max-old-space-size=4096\" app.js",
    "start": "node --max-old-space-size=4096 app.js",
    "test": "jest",
    "lint": "eslint .",
    "format": "prettier --write .",
    "cleanup": "node cleanup-sessions.js",
    "debug": "node --inspect app.js"
  }
}
```

## Production Deployment

### 1. Server Preparation

#### System Updates
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get upgrade -y

# Install essential tools
sudo apt-get install -y curl wget git build-essential

# Create application user
sudo useradd -m -s /bin/bash whatsapp
sudo usermod -aG sudo whatsapp
```

#### Node.js Production Setup
```bash
# Install Node.js via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version

# Install PM2 globally for process management
sudo npm install -g pm2
```

### 2. Application Deployment

#### Clone and Setup
```bash
# Switch to application user
sudo su - whatsapp

# Clone repository
git clone <repository-url> /home/whatsapp/whatsapp-api
cd /home/whatsapp/whatsapp-api

# Install production dependencies
npm ci --only=production

# Create production environment file
cp .env.example .env
```

#### Production Environment Configuration
```bash
# /home/whatsapp/whatsapp-api/.env
NODE_ENV=production
PORT=3000

# Database - Use MongoDB Atlas or configured production MongoDB
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/whatsapp_api

# Security - Generate strong secrets
JWT_SECRET=your_production_jwt_secret_256_bits_minimum_length_here

# Redis for session storage and Socket.IO scaling
REDIS_URL=redis://localhost:6379
SOCKET_IO_REDIS_ADAPTER=true

# Logging
LOG_LEVEL=info
```

#### PM2 Configuration
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'whatsapp-api',
    script: 'app.js',
    cwd: '/home/whatsapp/whatsapp-api',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/home/whatsapp/logs/err.log',
    out_file: '/home/whatsapp/logs/out.log',
    log_file: '/home/whatsapp/logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=4096'
  }]
};
```

#### Start Production Server
```bash
# Create logs directory
mkdir -p /home/whatsapp/logs

# Start with PM2
pm2 start ecosystem.config.js --env production

# Enable PM2 startup
pm2 startup
pm2 save
```

### 3. Reverse Proxy Setup (Nginx)

#### Install Nginx
```bash
sudo apt-get install -y nginx
```

#### Nginx Configuration
```nginx
# /etc/nginx/sites-available/whatsapp-api
server {
    listen 80;
    server_name your-domain.com;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

    location / {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    location /api/auth/ {
        limit_req zone=auth burst=5 nodelay;
        
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Enable Nginx Site
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/whatsapp-api /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 4. SSL Certificate (Let's Encrypt)

#### Install Certbot
```bash
sudo apt-get install -y certbot python3-certbot-nginx
```

#### Generate SSL Certificate
```bash
# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run

# Set up auto-renewal cron job
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Environment Configuration

### 1. Environment Variables Reference

#### Required Variables
```bash
# Application Environment
NODE_ENV=production                    # development, production, test

# Server Configuration
PORT=3000                             # Server port number

# Database Configuration
MONGO_URI=mongodb://localhost:27017/whatsapp_api  # MongoDB connection string

# Security Configuration
JWT_SECRET=your_jwt_secret_here       # JWT token signing secret (min 32 chars)
```

#### Optional Variables
```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379      # Redis server URL
SOCKET_IO_REDIS_ADAPTER=false         # Use Redis for Socket.IO scaling

# Logging Configuration
LOG_LEVEL=info                        # error, warn, info, debug

# Session Configuration
MAX_CONCURRENT_SESSIONS=50            # Maximum concurrent sessions
SESSION_TIMEOUT=900000                # Session timeout (15 minutes)
QR_EXPIRY_TIME=300000                # QR expiry time (5 minutes)

# File Upload Configuration
MAX_FILE_SIZE=10485760               # 10MB file upload limit
UPLOAD_PATH=./uploads                # Upload directory path

# Rate Limiting
RATE_LIMIT_WINDOW=60000             # Rate limit window (1 minute)
RATE_LIMIT_MAX=100                  # Max requests per window
```

### 2. Environment-Specific Configurations

#### Development (.env.development)
```bash
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://localhost:27017/whatsapp_api_dev
JWT_SECRET=development_jwt_secret_for_testing_only
LOG_LEVEL=debug
REDIS_URL=redis://localhost:6379
SOCKET_IO_REDIS_ADAPTER=false
```

#### Production (.env.production)
```bash
NODE_ENV=production
PORT=3000
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/whatsapp_api
JWT_SECRET=very_secure_production_jwt_secret_with_minimum_256_bits
LOG_LEVEL=info
REDIS_URL=rediss://user:pass@redis.cloud.com:6380
SOCKET_IO_REDIS_ADAPTER=true
```

#### Testing (.env.test)
```bash
NODE_ENV=test
PORT=3001
MONGO_URI=mongodb://localhost:27017/whatsapp_api_test
JWT_SECRET=test_jwt_secret_for_automated_testing
LOG_LEVEL=error
```

### 3. Configuration Validation

#### Joi Schema Validation
```javascript
// src/config/config.js validation schema
const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .required()
    .description('Node Environment'),
  
  PORT: Joi.number()
    .default(3000)
    .description('Port the server runs on'),
  
  MONGO_URI: Joi.string()
    .uri()
    .required()
    .description('MongoDB connection URI'),
  
  JWT_SECRET: Joi.string()
    .min(32)
    .required()
    .description('JWT secret key (minimum 32 characters)'),
  
  REDIS_URL: Joi.string()
    .uri()
    .optional()
    .description('Redis server URL'),
  
  SOCKET_IO_REDIS_ADAPTER: Joi.boolean()
    .default(false)
    .description('Use Redis for Socket.IO adapter'),
    
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info')
    .description('Logging level')
}).unknown();
```

## Database Setup

### 1. MongoDB Configuration

#### Local MongoDB Setup
```bash
# Install MongoDB
sudo apt-get install -y mongodb-org

# Configure MongoDB
sudo nano /etc/mongod.conf
```

```yaml
# /etc/mongod.conf
storage:
  dbPath: /var/lib/mongodb
  journal:
    enabled: true

systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log

net:
  port: 27017
  bindIp: 127.0.0.1

security:
  authorization: enabled

replication:
  replSetName: "whatsapp-rs"
```

#### Start MongoDB
```bash
# Start and enable MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Initialize replica set (required for transactions)
mongosh --eval "rs.initiate()"
```

#### Create Database User
```bash
# Connect to MongoDB
mongosh

# Switch to admin database
use admin

# Create admin user
db.createUser({
  user: "admin",
  pwd: "secure_admin_password",
  roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
})

# Create application user
use whatsapp_api
db.createUser({
  user: "whatsapp_user",
  pwd: "secure_app_password",
  roles: [ { role: "readWrite", db: "whatsapp_api" } ]
})
```

### 2. Database Optimization

#### Connection Pool Configuration
```javascript
// src/config/db.js
const options = {
  // Connection Pool Settings
  maxPoolSize: 10,           // Maximum connections
  minPoolSize: 5,            // Minimum connections
  maxIdleTimeMS: 30000,      // Close connections after 30s idle
  
  // Timeout Settings
  serverSelectionTimeoutMS: 5000,   // Server selection timeout
  socketTimeoutMS: 45000,           // Socket timeout
  connectTimeoutMS: 10000,          // Connection timeout
  
  // Network Settings
  family: 4,                 // Use IPv4 only
  useNewUrlParser: true,     // Use new URL parser
  useUnifiedTopology: true,  // Use new topology engine
  
  // Buffering
  bufferMaxEntries: 0        // Disable buffering for better error handling
};
```

#### Indexing Strategy
```javascript
// Database indexes for performance
const indexes = [
  // Session collection
  { collection: 'sessions', index: { sessionId: 1 }, unique: true },
  { collection: 'sessions', index: { phoneNumber: 1 } },
  { collection: 'sessions', index: { status: 1 } },
  { collection: 'sessions', index: { createdAt: 1 } },
  { collection: 'sessions', index: { lastActivity: 1 } },
  
  // Messages collection
  { collection: 'messages', index: { sessionId: 1, chatId: 1 } },
  { collection: 'messages', index: { messageId: 1 }, unique: true },
  { collection: 'messages', index: { timestamp: 1 } },
  { collection: 'messages', index: { fromMe: 1 } },
  
  // Compound indexes
  { collection: 'messages', index: { sessionId: 1, timestamp: -1 } },
  { collection: 'messages', index: { chatId: 1, timestamp: -1 } }
];
```

### 3. MongoDB Atlas Setup (Cloud)

#### Atlas Configuration Steps
1. **Create Atlas Account**:
   - Visit [MongoDB Atlas](https://www.mongodb.com/atlas)
   - Sign up for free account
   - Verify email address

2. **Create Cluster**:
   - Choose cloud provider (AWS recommended)
   - Select region (closest to your users)
   - Choose cluster tier (M0 for free tier)
   - Configure cluster name

3. **Database Security**:
   ```javascript
   // Create database user
   {
     "username": "whatsapp_user",
     "password": "secure_generated_password",
     "roles": [
       {
         "role": "readWrite",
         "database": "whatsapp_api"
       }
     ]
   }
   ```

4. **Network Access**:
   - Add IP addresses (0.0.0.0/0 for development, specific IPs for production)
   - Configure VPC peering if needed

5. **Connection String**:
   ```bash
   MONGO_URI=mongodb+srv://whatsapp_user:password@cluster.abc123.mongodb.net/whatsapp_api?retryWrites=true&w=majority
   ```

## Security Configuration

### 1. Application Security

#### JWT Configuration
```javascript
// Strong JWT secret generation
const crypto = require('crypto');
const jwtSecret = crypto.randomBytes(64).toString('hex');
console.log('JWT_SECRET=' + jwtSecret);
```

#### Rate Limiting
```javascript
// src/middleware/rateLimiting.js
import rateLimit from 'express-rate-limit';

// General API rate limiting
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false
});

// Authentication rate limiting
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth requests per windowMs
  message: 'Too many authentication attempts',
  skipSuccessfulRequests: true
});
```

#### Input Validation
```javascript
// src/middleware/validation.js
import Joi from 'joi';

export const validateSessionId = (req, res, next) => {
  const schema = Joi.object({
    sessionId: Joi.string()
      .alphanum()
      .min(3)
      .max(50)
      .required()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Invalid session ID format'
    });
  }
  
  next();
};
```

### 2. Network Security

#### Nginx Security Headers
```nginx
# Security headers
add_header X-Content-Type-Options nosniff;
add_header X-Frame-Options DENY;
add_header X-XSS-Protection "1; mode=block";
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Content-Security-Policy "default-src 'self'";
add_header Referrer-Policy "strict-origin-when-cross-origin";

# Hide Nginx version
server_tokens off;
```

#### Firewall Configuration
```bash
# Configure UFW (Ubuntu Firewall)
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow necessary ports
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow MongoDB (only from localhost)
sudo ufw allow from 127.0.0.1 to any port 27017

# Check status
sudo ufw status verbose
```

### 3. File System Security

#### Directory Permissions
```bash
# Set proper ownership
sudo chown -R whatsapp:whatsapp /home/whatsapp/whatsapp-api

# Set directory permissions
sudo chmod 755 /home/whatsapp/whatsapp-api
sudo chmod 750 /home/whatsapp/whatsapp-api/sessions
sudo chmod 640 /home/whatsapp/whatsapp-api/.env

# Protect sensitive files
sudo chmod 600 /home/whatsapp/whatsapp-api/.env
sudo chmod 600 /home/whatsapp/whatsapp-api/ecosystem.config.js
```

#### Session File Security
```javascript
// src/services/SessionManager.js
async cleanupSessionFiles(sessionId) {
  try {
    const sessionPath = path.join(process.cwd(), 'sessions', sessionId);
    
    // Verify path is within sessions directory (prevent path traversal)
    const resolvedPath = path.resolve(sessionPath);
    const sessionsDir = path.resolve(process.cwd(), 'sessions');
    
    if (!resolvedPath.startsWith(sessionsDir)) {
      throw new Error('Invalid session path');
    }
    
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      logger.info(`Cleaned up session files for ${sessionId}`);
    }
  } catch (error) {
    logger.error(`Error cleaning up session files for ${sessionId}:`, error);
  }
}
```

## Monitoring & Logging

### 1. Application Logging

#### Winston Logger Configuration
```javascript
// src/utils/logger.js
import winston from 'winston';
import path from 'path';

const logDir = 'logs';
const env = process.env.NODE_ENV || 'development';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'whatsapp-api' },
  transports: [
    // Error log
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Combined log
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Console log for development
    ...(env === 'development' ? [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ] : [])
  ]
});

export default logger;
```

### 2. System Monitoring

#### PM2 Monitoring
```bash
# Monitor processes
pm2 monit

# View logs
pm2 logs whatsapp-api

# Application metrics
pm2 show whatsapp-api

# System information
pm2 info
```

#### Health Check Endpoint
```javascript
// Enhanced health check
app.get('/api/health/detailed', async (req, res) => {
  try {
    const health = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: 'WhatsApp API Server',
      version: process.env.npm_package_version,
      uptime: process.uptime(),
      
      // System metrics
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      
      // Application metrics
      sessions: {
        active: SessionManager.activeConnections.size,
        max: SessionManager.config.MAX_CONCURRENT_SESSIONS,
        utilization: Math.round((SessionManager.activeConnections.size / SessionManager.config.MAX_CONCURRENT_SESSIONS) * 100)
      },
      
      // Database status
      database: {
        status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        host: mongoose.connection.host,
        name: mongoose.connection.name
      }
    };

    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: error.message
    });
  }
});
```

### 3. Log Analysis

#### Log Rotation Setup
```bash
# Create logrotate configuration
sudo nano /etc/logrotate.d/whatsapp-api
```

```bash
# /etc/logrotate.d/whatsapp-api
/home/whatsapp/whatsapp-api/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 whatsapp whatsapp
    postrotate
        pm2 reloadLogs
    endscript
}
```

#### Log Monitoring with Tail
```bash
# Monitor all logs
tail -f /home/whatsapp/whatsapp-api/logs/*.log

# Monitor specific log
tail -f /home/whatsapp/whatsapp-api/logs/error.log

# Monitor with filtering
tail -f /home/whatsapp/whatsapp-api/logs/combined.log | grep ERROR
```

## Troubleshooting

### 1. Common Issues

#### Port Already in Use
```bash
# Find process using port
sudo lsof -i :3000

# Kill process
sudo kill -9 <PID>

# Or change port in .env
PORT=3001
```

#### MongoDB Connection Issues
```bash
# Check MongoDB status
sudo systemctl status mongod

# View MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log

# Test connection
mongosh --eval "db.adminCommand('ismaster')"

# Restart MongoDB
sudo systemctl restart mongod
```

#### Session Directory Permissions
```bash
# Fix permissions
sudo chown -R whatsapp:whatsapp /home/whatsapp/whatsapp-api
sudo chmod -R 755 /home/whatsapp/whatsapp-api/sessions

# Verify permissions
ls -la /home/whatsapp/whatsapp-api/sessions/
```

#### Memory Issues
```bash
# Check memory usage
free -h

# Check application memory
pm2 show whatsapp-api

# Restart application
pm2 restart whatsapp-api

# Increase memory limit
pm2 start app.js --node-args="--max-old-space-size=4096"
```

### 2. Debug Mode

#### Enable Debug Logging
```bash
# Set debug level
LOG_LEVEL=debug npm start

# Node.js debug mode
node --inspect app.js

# PM2 with debug
pm2 start app.js --node-args="--inspect"
```

#### Debug Session Issues
```bash
# Run session cleanup
node cleanup-sessions.js

# Run emergency cleanup
node emergency-cleanup-sessions.js

# Debug specific session
node debug-sessions.js <sessionId>
```

### 3. Performance Issues

#### Check Resource Usage
```bash
# System resources
htop
# or
top

# Disk usage
df -h

# Network connections
netstat -tulpn | grep :3000

# Application specific
pm2 monit
```

#### Database Performance
```bash
# MongoDB performance
mongosh --eval "db.stats()"

# Check slow queries
mongosh --eval "db.setProfilingLevel(2, { slowms: 100 })"

# Index usage
mongosh --eval "db.sessions.getIndexes()"
```

## Performance Tuning

### 1. Node.js Optimization

#### Memory Settings
```bash
# Increase heap size
node --max-old-space-size=4096 app.js

# Optimize garbage collection
node --optimize-for-size app.js

# Enable performance monitoring
node --perf-basic-prof app.js
```

#### Cluster Mode
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'whatsapp-api',
    script: 'app.js',
    instances: 'max', // Use all CPU cores
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    
    // Performance optimizations
    node_args: [
      '--max-old-space-size=4096',
      '--optimize-for-size'
    ].join(' ')
  }]
};
```

### 2. Database Optimization

#### Connection Pool Tuning
```javascript
const options = {
  maxPoolSize: Math.min(10, require('os').cpus().length * 2),
  minPoolSize: 2,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
};
```

#### Query Optimization
```javascript
// Use projection to limit fields
const sessions = await WhatsAppSession
  .find({ status: 'active' })
  .select('sessionId phoneNumber status')
  .limit(50)
  .lean(); // Use lean for read-only operations

// Use indexes effectively
const messages = await Message
  .find({ sessionId, chatId })
  .sort({ timestamp: -1 })
  .limit(20)
  .lean();
```

### 3. Session Management Optimization

#### Cleanup Tuning
```javascript
// Aggressive cleanup for high-traffic servers
const config = {
  QR_EXPIRY_TIME: 3 * 60 * 1000,        // 3 minutes (reduced)
  SESSION_IDLE_TIME: 10 * 60 * 1000,    // 10 minutes (reduced)
  CLEANUP_INTERVAL: 2 * 60 * 1000,      // 2 minutes (increased frequency)
  MAX_CONCURRENT_SESSIONS: 100          // Increased limit
};
```

#### Memory-Efficient Session Storage
```javascript
// Use WeakMap for automatic garbage collection
const sessionCache = new WeakMap();

// Implement session data compression
const compressSessionData = (data) => {
  return {
    id: data.sessionId,
    status: data.status,
    lastActivity: data.lastActivity.getTime(),
    user: data.user ? {
      id: data.user.id,
      name: data.user.name
    } : null
  };
};
```

## Backup & Recovery

### 1. Database Backup

#### MongoDB Backup Script
```bash
#!/bin/bash
# backup-mongodb.sh

BACKUP_DIR="/home/whatsapp/backups/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="whatsapp_api_backup_$DATE"

# Create backup directory
mkdir -p $BACKUP_DIR

# Create backup
mongodump --db whatsapp_api --out $BACKUP_DIR/$BACKUP_NAME

# Compress backup
tar -czf $BACKUP_DIR/$BACKUP_NAME.tar.gz -C $BACKUP_DIR $BACKUP_NAME

# Remove uncompressed backup
rm -rf $BACKUP_DIR/$BACKUP_NAME

# Keep only last 7 backups
cd $BACKUP_DIR
ls -t *.tar.gz | tail -n +8 | xargs rm -f

echo "Backup completed: $BACKUP_NAME.tar.gz"
```

#### Automated Backup (Crontab)
```bash
# Add to crontab
crontab -e

# Daily backup at 2 AM
0 2 * * * /home/whatsapp/scripts/backup-mongodb.sh >> /home/whatsapp/logs/backup.log 2>&1
```

### 2. Application Backup

#### Code and Configuration Backup
```bash
#!/bin/bash
# backup-application.sh

APP_DIR="/home/whatsapp/whatsapp-api"
BACKUP_DIR="/home/whatsapp/backups/application"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup application files (excluding node_modules and logs)
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz \
  --exclude='node_modules' \
  --exclude='logs' \
  --exclude='sessions' \
  -C /home/whatsapp whatsapp-api

echo "Application backup completed: app_backup_$DATE.tar.gz"
```

### 3. Recovery Procedures

#### Database Recovery
```bash
# Stop application
pm2 stop whatsapp-api

# Restore from backup
tar -xzf /home/whatsapp/backups/mongodb/whatsapp_api_backup_20250115_020000.tar.gz

# Drop existing database (if needed)
mongosh --eval "use whatsapp_api; db.dropDatabase();"

# Restore database
mongorestore --db whatsapp_api whatsapp_api_backup_20250115_020000/whatsapp_api/

# Start application
pm2 start whatsapp-api
```

#### Application Recovery
```bash
# Stop application
pm2 stop whatsapp-api

# Backup current installation
mv /home/whatsapp/whatsapp-api /home/whatsapp/whatsapp-api.backup

# Extract backup
tar -xzf /home/whatsapp/backups/application/app_backup_20250115_020000.tar.gz -C /home/whatsapp

# Restore node_modules
cd /home/whatsapp/whatsapp-api
npm ci --only=production

# Start application
pm2 start whatsapp-api
```

### 4. Disaster Recovery Plan

#### Complete System Recovery
1. **Server Provisioning**: Set up new server with same specifications
2. **System Dependencies**: Install Node.js, MongoDB, Nginx, PM2
3. **Application Restoration**: Deploy application from backup
4. **Database Restoration**: Restore from latest backup
5. **DNS Update**: Update DNS records to point to new server
6. **SSL Certificate**: Install SSL certificate
7. **Monitoring Setup**: Configure monitoring and alerting
8. **Testing**: Verify all functionality works correctly

#### Recovery Time Objectives
- **Database Recovery**: 15 minutes
- **Application Recovery**: 30 minutes
- **Complete System Recovery**: 2 hours
- **DNS Propagation**: 24 hours (maximum)

This comprehensive setup and deployment guide provides everything needed to successfully deploy and maintain the WhatsApp API system in both development and production environments.
