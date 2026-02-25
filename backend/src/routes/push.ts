// ============================================================================
// push.ts — Web Push subscription management
//
// GET  /api/push/vapid-public-key   → { publicKey }    (public, no auth)
// POST /api/push/subscribe          → save subscription (requires JWT via parent router)
// DELETE /api/push/unsubscribe      → remove subscription (requires JWT)
// POST /api/push/snooze             → snooze alarm type (validated by endpoint, no JWT)
// ============================================================================

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
  saveSubscription,
  removeSubscription,
  isKnownEndpoint,
  setSnooze,
} from '../alarms/subscriptionStore.js';
import type { PushSubscriptionData } from '../alarms/subscriptionStore.js';
import type { AlarmType } from '../alarms/types.js';

const SNOOZE_MIN_DURATION_MS = 5 * 60_000;    // 5 min minimum
const SNOOZE_MAX_DURATION_MS = 24 * 60 * 60_000; // 24 h maximum

const router = Router();

// GET /api/push/vapid-public-key — public endpoint (no auth required)
// Note: the parent router in index.ts exposes this BEFORE authenticate middleware.
router.get('/vapid-public-key', (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    return res.status(503).json({
      success: false,
      error: 'Web Push not configured on this server',
      timestamp: new Date().toISOString(),
    });
  }
  return res.json({ success: true, data: { publicKey: key }, timestamp: new Date().toISOString() });
});

// POST /api/push/subscribe — save a push subscription (requires JWT)
router.post('/subscribe', authenticate, async (req, res) => {
  const sub = req.body as PushSubscriptionData;
  if (!sub?.endpoint || !sub?.keys) {
    return res.status(400).json({
      success: false,
      error: 'Invalid push subscription object',
      timestamp: new Date().toISOString(),
    });
  }
  try {
    await saveSubscription(sub);
    return res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ success: false, error: msg, timestamp: new Date().toISOString() });
  }
});

// DELETE /api/push/unsubscribe — remove subscription (requires JWT)
router.delete('/unsubscribe', authenticate, async (req, res) => {
  const { endpoint } = req.body as { endpoint?: string };
  if (!endpoint) {
    return res.status(400).json({
      success: false,
      error: 'endpoint is required',
      timestamp: new Date().toISOString(),
    });
  }
  try {
    await removeSubscription(endpoint);
    return res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ success: false, error: msg, timestamp: new Date().toISOString() });
  }
});

// POST /api/push/snooze — snooze an alarm type (no JWT, validated by subscription endpoint)
router.post('/snooze', async (req, res) => {
  const { subscriptionEndpoint, alarmType, durationMinutes } = req.body as {
    subscriptionEndpoint?: string;
    alarmType?: string;
    durationMinutes?: number;
  };

  if (!subscriptionEndpoint || !alarmType) {
    return res.status(400).json({
      success: false,
      error: 'subscriptionEndpoint and alarmType are required',
      timestamp: new Date().toISOString(),
    });
  }

  // Validate that the subscription is registered (prevents random snooze requests)
  const known = await isKnownEndpoint(subscriptionEndpoint).catch(() => false);
  if (!known) {
    return res.status(403).json({
      success: false,
      error: 'Unknown subscription endpoint',
      timestamp: new Date().toISOString(),
    });
  }

  const mins = typeof durationMinutes === 'number' ? durationMinutes : 30;
  const durationMs = Math.min(
    SNOOZE_MAX_DURATION_MS,
    Math.max(SNOOZE_MIN_DURATION_MS, mins * 60_000)
  );

  setSnooze(alarmType as AlarmType, durationMs);

  return res.json({
    success: true,
    data: { alarmType, snoozedForMins: Math.round(durationMs / 60_000) },
    timestamp: new Date().toISOString(),
  });
});

export default router;
