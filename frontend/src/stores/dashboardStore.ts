// ============================================================================
// Dashboard Store - Zustand Global State
// ============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GlucoseUnit } from '../lib/glucose';
import type { AppSettings } from '../lib/api';

export type Period = '1h' | '3h' | '6h' | '12h' | '24h' | '7d' | '14d' | '30d';

interface DashboardState {
  period: Period;
  darkMode: boolean;
  lastRefresh: number;
  // Phase 4: user settings
  unit: GlucoseUnit;
  patientName: string;
  refreshInterval: number; // minutes
  setPeriod: (period: Period) => void;
  toggleDarkMode: () => void;
  triggerRefresh: () => void;
  setUnit: (unit: GlucoseUnit) => void;
  setPatientName: (name: string) => void;
  setRefreshInterval: (minutes: number) => void;
  initFromServer: (settings: AppSettings) => void;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      period: '24h',
      darkMode: false,
      lastRefresh: Date.now(),
      unit: 'mgdl',
      patientName: '',
      refreshInterval: 5,

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

      setUnit: (unit) => set({ unit }),

      setPatientName: (patientName) => set({ patientName }),

      setRefreshInterval: (refreshInterval) => set({ refreshInterval }),

      initFromServer: (settings) => set((state) => ({
        unit:            settings.unit            ?? state.unit,
        patientName:     settings.patientName     ?? state.patientName,
        refreshInterval: settings.refreshInterval ?? state.refreshInterval,
      })),
    }),
    {
      name: 'nightscout-dashboard',
      partialize: (state: DashboardState) => ({
        darkMode:        state.darkMode,
        period:          state.period,
        unit:            state.unit,
        patientName:     state.patientName,
        refreshInterval: state.refreshInterval,
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
