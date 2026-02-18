// ============================================================================
// Dashboard Store - Zustand Global State
// ============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GlucoseUnit } from '../lib/glucose';
import type { AppSettings } from '../lib/api';

export type Period = '1h' | '3h' | '6h' | '12h' | '24h' | '7d' | '14d' | '30d';

export interface AlarmThresholds {
  veryLow:  number;  // mg/dL, default 54
  low:      number;  // mg/dL, default 70
  high:     number;  // mg/dL, default 180
  veryHigh: number;  // mg/dL, default 250
}

const DEFAULT_THRESHOLDS: AlarmThresholds = {
  veryLow: 54, low: 70, high: 180, veryHigh: 250,
};

interface DashboardState {
  period: Period;
  darkMode: boolean;
  lastRefresh: number;
  alarmThresholds: AlarmThresholds;
  // Phase 4: user settings
  unit: GlucoseUnit;
  patientName: string;
  refreshInterval: number; // minutes
  dia: number;            // Duration of Insulin Action, hours (IOB calculation)
  setPeriod: (period: Period) => void;
  toggleDarkMode: () => void;
  triggerRefresh: () => void;
  setAlarmThresholds: (t: AlarmThresholds) => void;
  setUnit: (unit: GlucoseUnit) => void;
  setPatientName: (name: string) => void;
  setRefreshInterval: (minutes: number) => void;
  setDia: (hours: number) => void;
  initFromServer: (settings: AppSettings) => void;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      period: '24h',
      darkMode: false,
      lastRefresh: Date.now(),
      alarmThresholds: DEFAULT_THRESHOLDS,
      unit: 'mgdl',
      patientName: '',
      refreshInterval: 5,
      dia: 3,

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

      setAlarmThresholds: (t) => set({ alarmThresholds: t }),

      setUnit: (unit) => set({ unit }),

      setPatientName: (patientName) => set({ patientName }),

      setRefreshInterval: (refreshInterval) => set({ refreshInterval }),

      setDia: (dia) => set({ dia }),

      initFromServer: (settings) => set((state) => ({
        unit:            settings.unit            ?? state.unit,
        patientName:     settings.patientName     ?? state.patientName,
        refreshInterval: settings.refreshInterval ?? state.refreshInterval,
        alarmThresholds: settings.alarmThresholds ?? state.alarmThresholds,
        dia:             settings.dia             ?? state.dia,
      })),
    }),
    {
      name: 'nightscout-dashboard',
      partialize: (state: DashboardState) => ({
        darkMode:        state.darkMode,
        period:          state.period,
        alarmThresholds: state.alarmThresholds,
        unit:            state.unit,
        patientName:     state.patientName,
        refreshInterval: state.refreshInterval,
        dia:             state.dia,
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
