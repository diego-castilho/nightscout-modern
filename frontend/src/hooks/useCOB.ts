// ============================================================================
// useCOB - Real-time Carbs on Board calculation
// ============================================================================
// Fetches carb treatments from the last 8 hours (enough for any realistic
// meal size at any absorption rate ≥ 10 g/h: 240g / 10 g/h = 24h covered
// by capping at 8h which handles up to 240g at 30 g/h comfortably).
// Recalculates every 60 s so the value decrements in real time.
// Uses the shared treatmentsCache to avoid duplicate requests with useIOB.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { getCachedTreatments } from '../lib/treatmentsCache';
import { calculateCOB } from '../lib/cob';
import { useDashboardStore } from '../stores/dashboardStore';

export function useCOB(): number {
  const { carbAbsorptionRate, lastRefresh } = useDashboardStore();
  const [cob, setCob] = useState(0);

  const recalculate = useCallback(async () => {
    try {
      const treatments = await getCachedTreatments(lastRefresh);
      setCob(calculateCOB(treatments, carbAbsorptionRate));
    } catch {
      // Keep previous value on fetch error
    }
  }, [carbAbsorptionRate, lastRefresh]);

  useEffect(() => {
    recalculate();
    const timer = setInterval(recalculate, 60_000);
    return () => clearInterval(timer);
  }, [recalculate]);

  return cob;
}
