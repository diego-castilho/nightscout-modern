// ============================================================================
// useIOB - Real-time Insulin on Board calculation
// ============================================================================
// Fetches all insulin treatments within the last DIA hours, then runs
// calculateIOB(). Re-runs every 60 s so the value decrements in real time
// even when no new data arrives. Re-fetches whenever lastRefresh changes
// (i.e. after a new treatment is registered via the careportal modal).
// Uses the shared treatmentsCache to avoid duplicate requests with useCOB.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { getCachedTreatments } from '../lib/treatmentsCache';
import { calculateIOB } from '../lib/iob';
import { useDashboardStore } from '../stores/dashboardStore';

export function useIOB(): number {
  const { dia, lastRefresh, scheduledBasalRate } = useDashboardStore();
  const [iob, setIob] = useState(0);

  const recalculate = useCallback(async () => {
    try {
      const allTreatments = await getCachedTreatments(lastRefresh);
      // Filter to the DIA window (cache covers 8 h; IOB only needs dia hours).
      const cutoff = Date.now() - dia * 3_600_000;
      const treatments = allTreatments.filter(
        (t) => new Date(t.created_at).getTime() >= cutoff,
      );
      setIob(calculateIOB(treatments, dia, scheduledBasalRate));
    } catch {
      // Keep previous value on fetch error
    }
  }, [dia, lastRefresh, scheduledBasalRate]);

  useEffect(() => {
    recalculate();
    const timer = setInterval(recalculate, 60_000);
    return () => clearInterval(timer);
  }, [recalculate]);

  return iob;
}
