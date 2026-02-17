// ============================================================================
// useGlucoseData Hook - Fetches glucose entries for charts
// ============================================================================

import { useState, useEffect } from 'react';
import { getGlucoseRange, getLatestGlucose, getAnalytics } from '../lib/api';
import { useDashboardStore, getPeriodDates } from '../stores/dashboardStore';
import type { GlucoseEntry, GlucoseAnalytics } from '../lib/api';

interface GlucoseDataState {
  entries: GlucoseEntry[];
  latest: GlucoseEntry | null;
  analytics: GlucoseAnalytics | null;
  loading: boolean;
  error: string | null;
}

export function useGlucoseData() {
  const { period, lastRefresh, refreshInterval, alarmThresholds } = useDashboardStore();
  const [state, setState] = useState<GlucoseDataState>({
    entries: [],
    latest: null,
    analytics: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const { startDate, endDate } = getPeriodDates(period);

        const [entriesRes, latestRes, analyticsRes] = await Promise.all([
          getGlucoseRange(startDate, endDate),
          getLatestGlucose(),
          getAnalytics(startDate, endDate, alarmThresholds),
        ]);

        if (cancelled) return;

        setState({
          entries: entriesRes,
          latest: latestRes,
          analytics: analyticsRes,
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Erro ao carregar dados',
        }));
      }
    }

    fetchData();

    // Auto-refresh at the configured interval
    const interval = setInterval(fetchData, refreshInterval * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [period, lastRefresh, refreshInterval, alarmThresholds]);

  return state;
}
