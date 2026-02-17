// ============================================================================
// Glucose Entries API Routes
// ============================================================================

import { Router } from 'express';
import {
  getGlucoseEntries,
  getLatestGlucose,
  getGlucoseByDateRange,
} from '../db/queries.js';
import type { ApiResponse, GlucoseQueryParams } from '../types/index.js';

const router = Router();

// GET /api/glucose - Get glucose entries with optional filters
router.get('/', async (req, res) => {
  try {
    const params: GlucoseQueryParams = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      skip: req.query.skip ? parseInt(req.query.skip as string) : undefined,
    };

    const entries = await getGlucoseEntries(params);

    const response: ApiResponse = {
      success: true,
      data: entries,
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    console.error('Error fetching glucose entries:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch glucose entries',
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/glucose/latest - Get most recent glucose reading
router.get('/latest', async (_req, res) => {
  try {
    const entry = await getLatestGlucose();

    const response: ApiResponse = {
      success: true,
      data: entry,
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    console.error('Error fetching latest glucose:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch latest glucose',
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/glucose/range - Get glucose entries within date range
router.get('/range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required',
        timestamp: new Date().toISOString(),
      });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    const entries = await getGlucoseByDateRange(start, end);

    const response: ApiResponse = {
      success: true,
      data: entries,
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    console.error('Error fetching glucose range:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch glucose range',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
