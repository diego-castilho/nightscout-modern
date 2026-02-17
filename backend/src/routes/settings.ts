// ============================================================================
// Settings API Routes - Persist user settings in MongoDB
// ============================================================================

import { Router } from 'express';
import { getDatabase } from '../db/connection.js';

const router = Router();

const COLLECTION = 'app_settings';
const DOC_KEY    = 'global';

// GET /api/settings - Return stored settings (null if never saved)
router.get('/', async (_req, res) => {
  try {
    const db  = getDatabase();
    const doc = await db.collection(COLLECTION).findOne({ key: DOC_KEY });
    return res.json({
      success: true,
      data: doc?.data ?? null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch settings',
      timestamp: new Date().toISOString(),
    });
  }
});

// PUT /api/settings - Save settings (upsert)
router.put('/', async (req, res) => {
  try {
    const db = getDatabase();
    await db.collection(COLLECTION).updateOne(
      { key: DOC_KEY },
      { $set: { key: DOC_KEY, data: req.body, updatedAt: new Date() } },
      { upsert: true }
    );
    return res.json({
      success: true,
      data: req.body,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error saving settings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to save settings',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
