// ============================================================================
// API Routes Index
// ============================================================================

import { Router } from 'express';
import glucoseRouter from './glucose.js';
import analyticsRouter from './analytics.js';
import settingsRouter from './settings.js';
import treatmentsRouter from './treatments.js';
import authRouter from './auth.js';
import { authenticate } from '../middleware/authenticate.js';
import { getDatabaseStats } from '../db/queries.js';

const router = Router();

// API root endpoint - show available endpoints
router.get('/', (_req, res) => {
  return res.json({
    success: true,
    message: 'Nightscout Modern API',
    version: '1.0.0',
    endpoints: {
      health: {
        url: '/api/health',
        method: 'GET',
        description: 'Health check endpoint',
      },
      stats: {
        url: '/api/stats',
        method: 'GET',
        description: 'Database statistics',
      },
      glucose: {
        url: '/api/glucose',
        method: 'GET',
        description: 'Get glucose entries',
        params: 'startDate, endDate, limit, skip',
      },
      glucoseLatest: {
        url: '/api/glucose/latest',
        method: 'GET',
        description: 'Get latest glucose reading',
      },
      glucoseRange: {
        url: '/api/glucose/range',
        method: 'GET',
        description: 'Get glucose in date range',
        params: 'startDate (required), endDate (required)',
      },
      analytics: {
        url: '/api/analytics',
        method: 'GET',
        description: 'Complete analytics report',
        params: 'startDate (required), endDate (required)',
      },
      analyticsStats: {
        url: '/api/analytics/stats',
        method: 'GET',
        description: 'Glucose statistics only',
        params: 'startDate (required), endDate (required)',
      },
      analyticsTir: {
        url: '/api/analytics/tir',
        method: 'GET',
        description: 'Time in Range statistics',
        params: 'startDate (required), endDate (required)',
      },
      analyticsPatterns: {
        url: '/api/analytics/patterns',
        method: 'GET',
        description: 'Daily patterns (hourly averages)',
        params: 'startDate (required), endDate (required)',
      },
      analyticsDetect: {
        url: '/api/analytics/detect',
        method: 'GET',
        description: 'Detect glucose patterns',
        params: 'startDate (required), endDate (required)',
      },
      treatments: {
        url: '/api/treatments',
        method: 'GET | POST | DELETE',
        description: 'List, create or delete treatment events',
        params: 'GET: startDate, endDate, limit, eventType | DELETE: /:id',
      },
    },
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint
router.get('/health', (_req, res) => {
  return res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Database stats endpoint
router.get('/stats', async (_req, res) => {
  try {
    const stats = await getDatabaseStats();
    return res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch database stats',
      timestamp: new Date().toISOString(),
    });
  }
});

// Public routes (no auth required)
router.use('/auth', authRouter);

// All routes below require a valid JWT
router.use(authenticate);

// Protected route modules
router.use('/glucose', glucoseRouter);
router.use('/analytics', analyticsRouter);
router.use('/settings', settingsRouter);
router.use('/treatments', treatmentsRouter);

// Debug endpoint — requer autenticação (JWT) para listar bancos de dados
router.get('/debug/databases', async (_req, res) => {
  try {
    const { MongoClient } = await import('mongodb');
    const uri = process.env.MONGODB_URI || 'mongodb://10.0.0.225:27017';
    const user = process.env.MONGODB_USER;
    const password = process.env.MONGODB_PASSWORD;

    let connectionUri = uri;
    if (user && password) {
      const url = new URL(uri);
      url.username = user;
      url.password = password;
      connectionUri = url.toString();
    }

    const client = new MongoClient(connectionUri);
    await client.connect();

    const adminDb = client.db().admin();
    const { databases } = await adminDb.listDatabases();

    await client.close();

    return res.json({
      success: true,
      data: databases,
      currentDb: process.env.MONGODB_DB_NAME || 'nightscout',
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      error: msg,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
