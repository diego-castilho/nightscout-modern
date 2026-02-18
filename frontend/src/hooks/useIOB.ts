// ============================================================================
// useIOB - Real-time Insulin on Board calculation
// ============================================================================
// Fetches all insulin treatments within the last DIA hours, then runs
// calculateIOB(). Re-runs every 60 s so the value decrements in real time
// even when no new data arrives. Re-fetches whenever lastRefresh changes
// (i.e. after a new treatment is registered via the careportal modal).
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { getTreatments } from '../lib/api';
import { calculateIOB } from '../lib/iob';
import { useDashboardStore } from '../stores/dashboardStore';

export function useIOB(): number {
  const { dia, lastRefresh, scheduledBasalRate } = useDashboardStore();
  const [iob, setIob] = useState(0);

  const recalculate = useCallback(async () => {
    try {
      const startDate = new Date(Date.now() - dia * 3_600_000).toISOString();
      const endDate   = new Date().toISOString();
      const treatments = await getTreatments({ startDate, endDate, limit: 200 });
      setIob(calculateIOB(treatments ?? [], dia, scheduledBasalRate));
    } catch {
      // Keep previous value on fetch error
    }
  }, [dia, lastRefresh, scheduledBasalRate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    recalculate();
    const timer = setInterval(recalculate, 60_000);
    return () => clearInterval(timer);
  }, [recalculate]);

  return iob;
}
