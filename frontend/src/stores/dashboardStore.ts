// ============================================================================
// Dashboard Store - Zustand Global State
// ============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GlucoseUnit } from '../lib/glucose';
import type { AppSettings } from '../lib/api';
import { DEFAULT_DEVICE_AGE_THRESHOLDS } from '../lib/deviceAge';
import type { DeviceAgeThresholds } from '../lib/deviceAge';

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
  dia: number;             // Duration of Insulin Action, hours (IOB calculation)
  carbAbsorptionRate: number; // g/hour for COB calculation (default 30)
  deviceAgeThresholds: DeviceAgeThresholds;
  scheduledBasalRate: number; // Pump scheduled basal rate U/h (0 = not configured / MDI user)
  isf:          number;    // Insulin Sensitivity Factor mg/dL per U (default 50)
  icr:          number;    // Insulin-to-Carb Ratio g per U (default 15)
  targetBG:     number;    // Target BG low end mg/dL (default 100)
  targetBGHigh: number;    // Target BG high end mg/dL (default 120)
  rapidPenStep:       0.5 | 1;  // Rapid pen dosing increment in U (default 1)
  predictionsDefault: boolean;   // AR2 prediction on by default (default false)
  setPeriod: (period: Period) => void;
  toggleDarkMode: () => void;
  setDarkMode: (dark: boolean) => void;
  triggerRefresh: () => void;
  setAlarmThresholds: (t: AlarmThresholds) => void;
  setUnit: (unit: GlucoseUnit) => void;
  setPatientName: (name: string) => void;
  setRefreshInterval: (minutes: number) => void;
  setDia: (hours: number) => void;
  setCarbAbsorptionRate: (gPerHour: number) => void;
  setDeviceAgeThresholds: (t: DeviceAgeThresholds) => void;
  setScheduledBasalRate: (rate: number) => void;
  setIsf:          (isf:          number)    => void;
  setIcr:          (icr:          number)    => void;
  setTargetBG:     (targetBG:     number)    => void;
  setTargetBGHigh: (targetBGHigh: number)    => void;
  setRapidPenStep:       (step: 0.5 | 1)  => void;
  setPredictionsDefault: (on: boolean)     => void;
  initFromServer: (settings: AppSettings) => void;
}

function applyThemeClasses(darkMode: boolean) {
  document.documentElement.classList.toggle('dark', darkMode);
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
      carbAbsorptionRate: 30,
      deviceAgeThresholds: DEFAULT_DEVICE_AGE_THRESHOLDS,
      scheduledBasalRate: 0,
      isf:          50,
      icr:          15,
      targetBG:     100,
      targetBGHigh: 120,
      rapidPenStep:       1,
      predictionsDefault: false,

      setPeriod: (period) => set({ period }),

      toggleDarkMode: () =>
        set((state) => {
          const next = !state.darkMode;
          applyThemeClasses(next);
          return { darkMode: next };
        }),

      setDarkMode: (dark) =>
        set(() => {
          applyThemeClasses(dark);
          return { darkMode: dark };
        }),

      triggerRefresh: () => set({ lastRefresh: Date.now() }),

      setAlarmThresholds: (t) => set({ alarmThresholds: t }),

      setUnit: (unit) => set({ unit }),

      setPatientName: (patientName) => set({ patientName }),

      setRefreshInterval: (refreshInterval) => set({ refreshInterval }),

      setDia: (dia) => set({ dia }),

      setCarbAbsorptionRate: (carbAbsorptionRate) => set({ carbAbsorptionRate }),

      setDeviceAgeThresholds: (deviceAgeThresholds) => set({ deviceAgeThresholds }),

      setScheduledBasalRate: (scheduledBasalRate) => set({ scheduledBasalRate }),

      setIsf:                (isf)                => set({ isf }),
      setIcr:                (icr)                => set({ icr }),
      setTargetBG:           (targetBG)           => set({ targetBG }),
      setTargetBGHigh:       (targetBGHigh)       => set({ targetBGHigh }),
      setRapidPenStep:       (rapidPenStep)       => set({ rapidPenStep }),
      setPredictionsDefault: (predictionsDefault) => set({ predictionsDefault }),

      initFromServer: (settings) => set((state) => ({
        unit:            settings.unit            ?? state.unit,
        patientName:     settings.patientName     ?? state.patientName,
        refreshInterval: settings.refreshInterval ?? state.refreshInterval,
        alarmThresholds: settings.alarmThresholds ?? state.alarmThresholds,
        dia:                    settings.dia                    ?? state.dia,
        carbAbsorptionRate:     settings.carbAbsorptionRate     ?? state.carbAbsorptionRate,
        deviceAgeThresholds: settings.deviceAgeThresholds
          ? { ...DEFAULT_DEVICE_AGE_THRESHOLDS, ...state.deviceAgeThresholds, ...settings.deviceAgeThresholds }
          : state.deviceAgeThresholds,
        scheduledBasalRate: settings.scheduledBasalRate ?? state.scheduledBasalRate,
        isf:          settings.isf          ?? state.isf,
        icr:          settings.icr          ?? state.icr,
        targetBG:     settings.targetBG     ?? state.targetBG,
        targetBGHigh: settings.targetBGHigh ?? state.targetBGHigh,
        rapidPenStep:       settings.rapidPenStep       ?? state.rapidPenStep,
        predictionsDefault: settings.predictionsDefault  ?? state.predictionsDefault,
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
        dia:                 state.dia,
        carbAbsorptionRate:  state.carbAbsorptionRate,
        deviceAgeThresholds: state.deviceAgeThresholds,
        scheduledBasalRate:  state.scheduledBasalRate,
        isf:          state.isf,
        icr:          state.icr,
        targetBG:           state.targetBG,
        targetBGHigh:       state.targetBGHigh,
        rapidPenStep:       state.rapidPenStep,
        predictionsDefault: state.predictionsDefault,
      }),
    }
  )
);

// Apply theme classes on startup from persisted state
const stored = localStorage.getItem('nightscout-dashboard');
if (stored) {
  try {
    const parsed = JSON.parse(stored);
    applyThemeClasses(!!parsed?.state?.darkMode);
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
