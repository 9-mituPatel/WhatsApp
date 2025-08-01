import express from 'express';
import config from "./src/config/config.js";
import cors from 'cors';
import { connectDB } from './src/config/db.js';
import logger from './src/utils/logger.js';
import router from './src/routes/index.js';
// import { specs, swaggerUi } from './swagger/index.js';



// Connect to MongoDB
await connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health Check Route
app.get('/', (req, res) => {
  logger.info('User visited root route');
  res.send(' Congratulations! Your server is running!');
});

// Test route
app.get('/log', (req, res) => {
  logger.info('Test log endpoint called');
  logger.warn('This is a test warning');
  logger.error('This is a test error');
  res.json({ message: 'Test logs generated', timestamp: new Date().toISOString() });
});

// Swagger Documentation
// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// API Routes
app.use('/api', router);

// Error Handler (Optional)
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({
    message: 'Internal Server Error',
    error: err.message,
  });
});

// Start Server
const PORT = config.port || 3000;
app.listen(PORT, () => {
  logger.info(`✅ Server running on port ${PORT}`);
});
