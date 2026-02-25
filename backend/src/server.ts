// ============================================================================
// Nightscout Modern - Backend Server
// ============================================================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { createServer } from 'http';
import dotenv from 'dotenv';

import { connectToDatabase } from './db/connection.js';
import { initializeWebSocket } from './websocket/index.js';
import { initWebPush } from './alarms/pushService.js';
import apiRoutes from './routes/index.js';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);

// ============================================================================
// Configuration
// ============================================================================

const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://10.0.0.225:27017';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'nightscout';
const MONGODB_USER = process.env.MONGODB_USER;
const MONGODB_PASSWORD = process.env.MONGODB_PASSWORD;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// ============================================================================
// Middleware
// ============================================================================

// Security headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: CORS_ORIGIN.split(',').map((origin) => origin.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ============================================================================
// Routes
// ============================================================================

// Root endpoint
app.get('/', (_req, res) => {
  return res.json({
    name: 'Nightscout Modern API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      stats: '/api/stats',
      glucose: '/api/glucose',
      analytics: '/api/analytics',
    },
  });
});

// API routes
app.use('/api', apiRoutes);

// 404 handler
app.use((req, res) => {
  return res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    timestamp: new Date().toISOString(),
  });
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('❌ Server error:', err);
  return res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// Server Initialization
// ============================================================================

async function startServer() {
  try {
    console.log('');
    console.log('🚀 Starting Nightscout Modern Backend...');
    console.log('='.repeat(50));

    // Connect to MongoDB
    await connectToDatabase({
      uri: MONGODB_URI,
      dbName: MONGODB_DB_NAME,
      user: MONGODB_USER,
      password: MONGODB_PASSWORD,
    });

    // Initialize WebSocket server
    initializeWebSocket(httpServer, CORS_ORIGIN);

    // Initialize Web Push (VAPID)
    initWebPush();

    // Start HTTP server
    httpServer.listen(PORT, () => {
      console.log('='.repeat(50));
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📍 API: http://localhost:${PORT}/api`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('='.repeat(50));
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
