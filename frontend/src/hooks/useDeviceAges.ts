// ============================================================================
// useDeviceAges — Real-time device age tracking (CAGE + pen ages)
// ============================================================================
// Fetches Site Change, Basal Pen Change and Rapid Pen Change treatments
// from the last 35 days (enough to detect any device never changed in a month).
// Recalculates every hour so the age increments visually in real time.
// Also re-fetches whenever lastRefresh or deviceAgeThresholds changes.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { getTreatments } from '../lib/api';
import { calculateDeviceAges } from '../lib/deviceAge';
import type { DeviceAges } from '../lib/deviceAge';
import { useDashboardStore } from '../stores/dashboardStore';

const FETCH_WINDOW_DAYS = 35;
const RECALC_INTERVAL_MS = 3_600_000; // 1 hour

const UNKNOWN_AGES: DeviceAges = {
  sage:     { hours: null, level: 'unknown', label: '—', createdAt: null },
  cage:     { hours: null, level: 'unknown', label: '—', createdAt: null },
  iage:     { hours: null, level: 'unknown', label: '—', createdAt: null },
  basalPen: { hours: null, level: 'unknown', label: '—', createdAt: null },
  rapidPen: { hours: null, level: 'unknown', label: '—', createdAt: null },
};

export function useDeviceAges(): DeviceAges {
  const { lastRefresh, deviceAgeThresholds } = useDashboardStore();
  const [ages, setAges] = useState<DeviceAges>(UNKNOWN_AGES);

  const recalculate = useCallback(async () => {
    try {
      const startDate = new Date(
        Date.now() - FETCH_WINDOW_DAYS * 24 * 3_600_000,
      ).toISOString();
      const endDate = new Date().toISOString();
      const treatments = await getTreatments({ startDate, endDate, limit: 500 });
      setAges(calculateDeviceAges(treatments ?? [], deviceAgeThresholds));
    } catch {
      // Keep previous value on fetch error
    }
  }, [lastRefresh, deviceAgeThresholds]);

  useEffect(() => {
    recalculate();
    const timer = setInterval(recalculate, RECALC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [recalculate]);

  return ages;
}
