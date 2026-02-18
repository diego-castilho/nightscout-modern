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

// Response interceptor (for error handling)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
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
  count: number;
  stdDev: number;
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

export default api;
