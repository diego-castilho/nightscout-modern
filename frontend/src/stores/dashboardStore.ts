// ============================================================================
// Dashboard Store - Zustand Global State
// ============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Period = '1h' | '3h' | '6h' | '12h' | '24h' | '7d' | '14d' | '30d';

export interface AlarmThresholds {
  veryLow:  number;  // default 54
  low:      number;  // default 70
  high:     number;  // default 180
  veryHigh: number;  // default 250
}

const DEFAULT_THRESHOLDS: AlarmThresholds = {
  veryLow: 54, low: 70, high: 180, veryHigh: 250,
};

interface DashboardState {
  period: Period;
  darkMode: boolean;
  lastRefresh: number;
  alarmEnabled: boolean;
  alarmThresholds: AlarmThresholds;
  setPeriod: (period: Period) => void;
  toggleDarkMode: () => void;
  triggerRefresh: () => void;
  toggleAlarm: () => void;
  setAlarmThresholds: (t: AlarmThresholds) => void;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      period: '24h',
      darkMode: false,
      lastRefresh: Date.now(),
      alarmEnabled: false,
      alarmThresholds: DEFAULT_THRESHOLDS,

      setPeriod: (period) => set({ period }),

      toggleDarkMode: () =>
        set((state) => {
          const next = !state.darkMode;
          if (next) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
          return { darkMode: next };
        }),

      triggerRefresh: () => set({ lastRefresh: Date.now() }),

      toggleAlarm: () => set((state) => ({ alarmEnabled: !state.alarmEnabled })),

      setAlarmThresholds: (t) => set({ alarmThresholds: t }),
    }),
    {
      name: 'nightscout-dashboard',
      partialize: (state: DashboardState) => ({
        darkMode:        state.darkMode,
        period:          state.period,
        alarmEnabled:    state.alarmEnabled,
        alarmThresholds: state.alarmThresholds,
      }),
    }
  )
);

// Apply dark mode class on startup from persisted state
const stored = localStorage.getItem('nightscout-dashboard');
if (stored) {
  try {
    const parsed = JSON.parse(stored);
    if (parsed?.state?.darkMode) {
      document.documentElement.classList.add('dark');
    }
  } catch {
    // ignore parse errors
  }
}

// Helper: calculate date range from period
export function getPeriodDates(period: Period): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = new Date();

  switch (period) {
    case '1h':
      startDate.setHours(startDate.getHours() - 1);
      break;
    case '3h':
      startDate.setHours(startDate.getHours() - 3);
      break;
    case '6h':
      startDate.setHours(startDate.getHours() - 6);
      break;
    case '12h':
      startDate.setHours(startDate.getHours() - 12);
      break;
    case '24h':
      startDate.setHours(startDate.getHours() - 24);
      break;
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '14d':
      startDate.setDate(startDate.getDate() - 14);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
  }

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
}
