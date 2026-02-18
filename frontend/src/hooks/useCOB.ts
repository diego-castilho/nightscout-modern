// ============================================================================
// useCOB - Real-time Carbs on Board calculation
// ============================================================================
// Fetches carb treatments from the last 8 hours (enough for any realistic
// meal size at any absorption rate ≥ 10 g/h: 240g / 10 g/h = 24h covered
// by capping at 8h which handles up to 240g at 30 g/h comfortably).
// Recalculates every 60 s so the value decrements in real time.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { getTreatments } from '../lib/api';
import { calculateCOB } from '../lib/cob';
import { useDashboardStore } from '../stores/dashboardStore';

// Maximum look-back window: covers a very large meal (240 g) at slowest
// typical rate (30 g/h → 8 h). Prevents unbounded fetches.
const FETCH_WINDOW_HOURS = 8;

export function useCOB(): number {
  const { carbAbsorptionRate, lastRefresh } = useDashboardStore();
  const [cob, setCob] = useState(0);

  const recalculate = useCallback(async () => {
    try {
      const startDate = new Date(
        Date.now() - FETCH_WINDOW_HOURS * 3_600_000,
      ).toISOString();
      const endDate = new Date().toISOString();
      const treatments = await getTreatments({ startDate, endDate, limit: 200 });
      setCob(calculateCOB(treatments ?? [], carbAbsorptionRate));
    } catch {
      // Keep previous value on fetch error
    }
  }, [carbAbsorptionRate, lastRefresh]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    recalculate();
    const timer = setInterval(recalculate, 60_000);
    return () => clearInterval(timer);
  }, [recalculate]);

  return cob;
}
