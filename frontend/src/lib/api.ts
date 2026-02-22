// ============================================================================
// API Client - Backend Communication
// ============================================================================

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor (for auth tokens, etc.)
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor — on 401, clear token and redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      // Avoid redirect loop when already on /login
      if (!window.location.pathname.startsWith('/login')) {
        localStorage.removeItem('authToken');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ============================================================================
// Glucose Endpoints
// ============================================================================

export interface GlucoseEntry {
  _id: string;
  sgv: number;
  date: number;
  dateString: string;
  trend?: number;
  direction?: string;
  device?: string;
  type: string;
  delta?: number;
}

export async function getLatestGlucose() {
  const response = await api.get<{ success: boolean; data: GlucoseEntry }>('/glucose/latest');
  return response.data.data;
}

export async function getGlucoseEntries(params?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  const response = await api.get<{ success: boolean; data: GlucoseEntry[] }>('/glucose', { params });
  return response.data.data;
}

export async function getGlucoseRange(startDate: string, endDate: string) {
  const response = await api.get<{ success: boolean; data: GlucoseEntry[] }>('/glucose/range', {
    params: { startDate, endDate },
  });
  return response.data.data;
}

// ============================================================================
// Analytics Endpoints
// ============================================================================

export interface GlucoseStats {
  average: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  cv: number;
  gmi: number;
  estimatedA1c: number;
}

export interface TimeInRange {
  veryLow: number;
  low: number;
  inRange: number;
  high: number;
  veryHigh: number;
  percentVeryLow: number;
  percentLow: number;
  percentInRange: number;
  percentHigh: number;
  percentVeryHigh: number;
}

export interface DailyPattern {
  hour: number;
  averageGlucose: number;
  median: number;
  count: number;
  stdDev: number;
  min: number;
  max: number;
  p5: number;
  p25: number;
  p75: number;
  p95: number;
}

export interface GlucoseAnalytics {
  period: {
    start: string;
    end: string;
    days: number;
  };
  stats: GlucoseStats;
  timeInRange: TimeInRange;
  dailyPatterns: DailyPattern[];
  totalReadings: number;
}

export async function getAnalytics(
  startDate: string,
  endDate: string,
  thresholds?: { veryLow?: number; low?: number; high?: number; veryHigh?: number }
) {
  const params: Record<string, string | number> = { startDate, endDate };
  if (thresholds) {
    if (thresholds.veryLow  !== undefined) params.veryLow  = thresholds.veryLow;
    if (thresholds.low      !== undefined) params.low      = thresholds.low;
    if (thresholds.high     !== undefined) params.high     = thresholds.high;
    if (thresholds.veryHigh !== undefined) params.veryHigh = thresholds.veryHigh;
  }
  // Analytics queries can be slow for long periods (7d/14d/30d) — use 45s timeout
  const response = await api.get<{ success: boolean; data: GlucoseAnalytics }>('/analytics', {
    params,
    timeout: 45_000,
  });
  return response.data.data;
}

export async function getStats(startDate: string, endDate: string) {
  const response = await api.get<{ success: boolean; data: GlucoseStats }>('/analytics/stats', {
    params: { startDate, endDate },
  });
  return response.data.data;
}

export async function getTimeInRange(startDate: string, endDate: string) {
  const response = await api.get<{ success: boolean; data: TimeInRange }>('/analytics/tir', {
    params: { startDate, endDate },
  });
  return response.data.data;
}

export async function getDailyPatterns(startDate: string, endDate: string) {
  const response = await api.get<{ success: boolean; data: DailyPattern[] }>('/analytics/patterns', {
    params: { startDate, endDate },
  });
  return response.data.data;
}

export interface DetectedPattern {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  hours?: number[];
  averageGlucose?: number;
}

export async function detectPatterns(startDate: string, endDate: string) {
  const response = await api.get<{ success: boolean; data: DetectedPattern[] }>('/analytics/detect', {
    params: { startDate, endDate },
    timeout: 45_000,
  });
  return response.data.data;
}

// ============================================================================
// Database Stats
// ============================================================================

export async function getDatabaseStats() {
  const response = await api.get('/stats');
  return response.data.data;
}

// ============================================================================
// Settings (server-side persistence)
// ============================================================================

export interface AppSettings {
  unit?: 'mgdl' | 'mmol';
  patientName?: string;
  refreshInterval?: number;
  dia?: number;
  carbAbsorptionRate?: number;
  alarmThresholds?: {
    veryLow: number;
    low: number;
    high: number;
    veryHigh: number;
  };
  deviceAgeThresholds?: {
    sageWarnD?:   number;
    sageUrgentD?: number;
    cageWarnH?:   number;
    cageUrgentH?: number;
    penWarnD?:    number;
    penUrgentD?:  number;
  };
  scheduledBasalRate?: number;
  isf?:          number;    // Insulin Sensitivity Factor mg/dL per U
  icr?:          number;    // Insulin-to-Carb Ratio g per U
  targetBG?:     number;    // Target blood glucose low end mg/dL
  targetBGHigh?: number;    // Target blood glucose high end mg/dL
  rapidPenStep?:       0.5 | 1;  // Rapid pen dosing increment in U
  predictionsDefault?: boolean;   // AR2 prediction enabled by default on chart
}

export async function getSettings(): Promise<AppSettings | null> {
  const response = await api.get<{ success: boolean; data: AppSettings | null }>('/settings');
  return response.data.data;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await api.put('/settings', settings);
}

// ============================================================================
// Treatments (Careportal)
// ============================================================================

export interface Treatment {
  _id: string;
  eventType: string;
  created_at: string;
  timestamp?: string;
  enteredBy?: string;
  glucose?: number;
  glucoseType?: string;
  carbs?: number;
  insulin?: number;
  units?: string;
  notes?: string;
  duration?: number;
  protein?: number;
  fat?: number;
  rate?:             number;                    // U/h (absolute) or % (relative) — Temp Basal
  rateMode?:         'absolute' | 'relative';  // Temp Basal rate mode
  exerciseType?:     string;                   // Exercise type (aeróbico, anaeróbico, misto)
  intensity?:        string;                   // Exercise intensity (leve, moderada, intensa)
  immediateInsulin?: number;                   // Combo Bolus: immediate component in U
  extendedInsulin?:  number;                   // Combo Bolus: extended component in U
  preBolus?:         number;                   // Carb time offset in minutes (negative = eaten before, positive = will eat after)
  mealType?:         string;                   // Meal sub-type: 'almoco'|'jantar'|'cafe_manha'|'lanche'
}

export async function getTreatments(params?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
  eventType?: string;
}): Promise<Treatment[]> {
  const response = await api.get<{ success: boolean; data: Treatment[] }>('/treatments', { params });
  return response.data.data;
}

export async function createTreatment(data: Omit<Treatment, '_id'>): Promise<Treatment> {
  const response = await api.post<{ success: boolean; data: Treatment }>('/treatments', data);
  return response.data.data;
}

export async function deleteTreatment(id: string): Promise<void> {
  await api.delete(`/treatments/${id}`);
}

// ============================================================================
// Calendar Endpoint
// ============================================================================

export interface CalendarDayData {
  date: string;        // "YYYY-MM-DD"
  avgGlucose: number;  // mg/dL
  minGlucose: number;
  maxGlucose: number;
  readings: number;
  hypoCount: number;
  hypoSevere: number;
  zone: 'veryLow' | 'low' | 'inRange' | 'high' | 'veryHigh' | 'noData';
}

export async function getCalendarData(
  startDate: string,
  endDate: string,
  thresholds?: { veryLow?: number; low?: number; high?: number; veryHigh?: number }
): Promise<CalendarDayData[]> {
  const params: Record<string, string | number> = { startDate, endDate };
  if (thresholds) {
    if (thresholds.veryLow  !== undefined) params.veryLow  = thresholds.veryLow;
    if (thresholds.low      !== undefined) params.low      = thresholds.low;
    if (thresholds.high     !== undefined) params.high     = thresholds.high;
    if (thresholds.veryHigh !== undefined) params.veryHigh = thresholds.veryHigh;
  }
  const response = await api.get<{ success: boolean; data: CalendarDayData[] }>('/analytics/calendar', {
    params,
    timeout: 30_000,
  });
  return response.data.data;
}

// ============================================================================
// Distribution / Advanced Variability Metrics
// ============================================================================

export interface HistogramBin {
  bin: number;
  count: number;
  percent: number;
}

export interface DistributionStats {
  totalReadings: number;
  gvi: number;
  pgs: number;
  jIndex: number;
  iqr: number;
  meanDailyChange: number;
  outOfRangeRms: number;
  timeInFluctuation: number;
  timeInRapidFluctuation: number;
  histogram: HistogramBin[];
}

export async function getDistributionStats(
  startDate: string,
  endDate: string,
  thresholds?: { low?: number; high?: number }
): Promise<DistributionStats> {
  const params: Record<string, string | number> = { startDate, endDate };
  if (thresholds?.low  !== undefined) params.low  = thresholds.low;
  if (thresholds?.high !== undefined) params.high = thresholds.high;
  const response = await api.get<{ success: boolean; data: DistributionStats }>(
    '/analytics/distribution',
    { params, timeout: 45_000 }
  );
  return response.data.data;
}

// ============================================================================
// Meal Patterns (Fase 6)
// ============================================================================

export type MealPeriod = 'cafe_manha' | 'almoco' | 'lanche' | 'jantar' | 'outro';

export interface MealEvent {
  treatmentId: string;
  eventType: string;
  mealType: MealPeriod;
  timestamp: number;
  hour: number;
  carbs: number;
  insulin: number;
  preMealGlucose: number | null;
  glucoseAt1h: number | null;
  glucoseAt2h: number | null;
  peakGlucose: number | null;
  peakDelta: number | null;
}

export interface MealPeriodStats {
  period: MealPeriod;
  label: string;
  count: number;
  avgPreMeal: number;
  avgAt1h: number;
  avgAt2h: number;
  avgPeak: number;
  avgDelta: number;
  avgCarbs: number;
  avgInsulin: number;
  events: MealEvent[];
}

export interface MealtimeData {
  periods: MealPeriodStats[];
  totalEvents: number;
}

export async function getMealtimeData(
  startDate: string,
  endDate: string
): Promise<MealtimeData> {
  const response = await api.get<{ success: boolean; data: MealtimeData }>(
    '/analytics/mealtime',
    { params: { startDate, endDate }, timeout: 45_000 }
  );
  return response.data.data;
}

// ============================================================================
// Auth Endpoints
// ============================================================================

export async function login(password: string): Promise<void> {
  const response = await api.post<{ success: boolean; data: { token: string; expiresIn: string } }>(
    '/auth/login',
    { password }
  );
  localStorage.setItem('authToken', response.data.data.token);
}

export async function generateAccessToken(): Promise<{ token: string; expiresIn: string }> {
  const response = await api.post<{ success: boolean; data: { token: string; expiresIn: string } }>(
    '/auth/generate-token'
  );
  return response.data.data;
}

export default api;
