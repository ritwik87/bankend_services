// Load environment variables FIRST
import dotenv from 'dotenv';
dotenv.config();

import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import routes from './routes';
import swaggerRoutes from './swagger/swagger.routes';
import logger from './utils/logger';

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration - Development mode (allow all localhost origins)
const corsOptions = {
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    body: req.method !== 'GET' ? req.body : undefined,
    query: req.query,
    ip: req.ip,
  });
  next();
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'DUPR Service API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    documentation: {
      swagger: `${req.protocol}://${req.get('host')}/docs`,
      openapi: `${req.protocol}://${req.get('host')}/docs/json`,
    },
  });
});

// Swagger documentation
app.use('/docs', swaggerRoutes);

// API routes
app.use('/api', routes);

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
