// ============================================================================
// Analytics API Routes
// ============================================================================

import { Router } from 'express';
import { getGlucoseByDateRange } from '../db/queries.js';
import {
  generateAnalytics,
  detectPatterns,
  calculateGlucoseStats,
  calculateTimeInRange,
  calculateDailyPatterns,
  calculateCalendarData,
  calculateDistributionStats,
} from '../services/analytics.js';
import type { ApiResponse } from '../types/index.js';

const router = Router();

// GET /api/analytics - Get complete analytics for a date range
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, veryLow, low, high, veryHigh } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required',
        timestamp: new Date().toISOString(),
      });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    const thresholds = {
      veryLow:  veryLow  ? Number(veryLow)  : undefined,
      low:      low      ? Number(low)      : undefined,
      high:     high     ? Number(high)     : undefined,
      veryHigh: veryHigh ? Number(veryHigh) : undefined,
    };

    const entries = await getGlucoseByDateRange(start, end);
    const analytics = generateAnalytics(entries, start, end, thresholds);

    const response: ApiResponse = {
      success: true,
      data: analytics,
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    console.error('Error generating analytics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate analytics',
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/analytics/stats - Get glucose statistics only
router.get('/stats', async (req, res) => {
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
    const stats = calculateGlucoseStats(entries);

    const response: ApiResponse = {
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    console.error('Error calculating stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to calculate statistics',
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/analytics/tir - Get Time in Range statistics
router.get('/tir', async (req, res) => {
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
    const tir = calculateTimeInRange(entries);

    const response: ApiResponse = {
      success: true,
      data: tir,
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    console.error('Error calculating TIR:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to calculate time in range',
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/analytics/patterns - Get daily patterns (hourly averages)
router.get('/patterns', async (req, res) => {
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
    const patterns = calculateDailyPatterns(entries);

    const response: ApiResponse = {
      success: true,
      data: patterns,
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    console.error('Error calculating patterns:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to calculate patterns',
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/analytics/detect - Detect glucose patterns (dawn phenomenon, etc.)
router.get('/detect', async (req, res) => {
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
    const detectedPatterns = detectPatterns(entries);

    const response: ApiResponse = {
      success: true,
      data: detectedPatterns,
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    console.error('Error detecting patterns:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to detect patterns',
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/analytics/calendar - Aggregated daily data for monthly calendar view
router.get('/calendar', async (req, res) => {
  try {
    const { startDate, endDate, veryLow, low, high, veryHigh } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required',
        timestamp: new Date().toISOString(),
      });
    }

    const start = new Date(startDate as string);
    const end   = new Date(endDate   as string);

    const thresholds = {
      veryLow:  veryLow  ? Number(veryLow)  : undefined,
      low:      low      ? Number(low)      : undefined,
      high:     high     ? Number(high)     : undefined,
      veryHigh: veryHigh ? Number(veryHigh) : undefined,
    };

    const entries = await getGlucoseByDateRange(start, end);
    const calendarData = calculateCalendarData(entries, start, thresholds);

    return res.json({
      success: true,
      data: calendarData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error generating calendar data:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate calendar data',
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/analytics/distribution - Histogram + advanced variability metrics
router.get('/distribution', async (req, res) => {
  try {
    const { startDate, endDate, low, high } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required',
        timestamp: new Date().toISOString(),
      });
    }

    const start = new Date(startDate as string);
    const end   = new Date(endDate   as string);

    const thresholds = {
      low:  low  ? Number(low)  : undefined,
      high: high ? Number(high) : undefined,
    };

    const entries = await getGlucoseByDateRange(start, end);
    const distribution = calculateDistributionStats(entries, thresholds);

    return res.json({
      success: true,
      data: distribution,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error calculating distribution:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to calculate distribution stats',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
