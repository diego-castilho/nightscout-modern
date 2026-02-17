// ============================================================================
// Type Definitions - Nightscout Data Models
// ============================================================================

export interface GlucoseEntry {
  _id: string;
  sgv: number; // Sensor Glucose Value (mg/dL)
  date: number; // Unix timestamp in milliseconds
  dateString: string;
  trend?: number; // Trend arrow (-2 to 2)
  direction?: string; // Direction arrow (DoubleUp, SingleUp, FortyFiveUp, Flat, etc.)
  device?: string;
  type: 'sgv' | 'mbg' | 'cal';
  noise?: number;
  filtered?: number;
  unfiltered?: number;
  rssi?: number;
  delta?: number;
}

export interface Treatment {
  _id: string;
  eventType: string; // 'Meal Bolus', 'Correction Bolus', 'Carb Correction', etc.
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

export interface DeviceStatus {
  _id: string;
  device: string;
  created_at: string;
  pump?: {
    battery?: {
      percent?: number;
      voltage?: number;
    };
    reservoir?: number;
    clock?: string;
  };
  uploader?: {
    battery?: number;
  };
  loop?: {
    iob?: {
      iob: number;
      basaliob: number;
      bolusIOB: number;
    };
    cob?: {
      cob: number;
    };
    predicted?: {
      values: number[];
      startDate: string;
    };
  };
}

export interface Profile {
  _id: string;
  defaultProfile: string;
  store: {
    [key: string]: {
      dia: number; // Duration of Insulin Action (hours)
      carbratio: Array<{ time: string; value: number; timeAsSeconds: number }>;
      carbs_hr: number;
      delay: number;
      sens: Array<{ time: string; value: number; timeAsSeconds: number }>;
      timezone: string;
      basal: Array<{ time: string; value: number; timeAsSeconds: number }>;
      target_low: Array<{ time: string; value: number; timeAsSeconds: number }>;
      target_high: Array<{ time: string; value: number; timeAsSeconds: number }>;
      startDate: string;
      units: string;
    };
  };
  startDate: string;
  mills: string;
  units: string;
  created_at: string;
}

// ============================================================================
// Analytics & Statistics Types
// ============================================================================

export interface GlucoseStats {
  average: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  cv: number; // Coefficient of Variation (%)
  gmi: number; // Glucose Management Indicator
  estimatedA1c: number;
}

export interface TimeInRange {
  veryLow: number; // < 54 mg/dL
  low: number; // 54-70 mg/dL
  inRange: number; // 70-180 mg/dL
  high: number; // 180-250 mg/dL
  veryHigh: number; // > 250 mg/dL
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
}

export interface GlucoseAnalytics {
  period: {
    start: Date;
    end: Date;
    days: number;
  };
  stats: GlucoseStats;
  timeInRange: TimeInRange;
  dailyPatterns: DailyPattern[];
  totalReadings: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// Request Types
// ============================================================================

export interface GlucoseQueryParams {
  startDate?: string;
  endDate?: string;
  limit?: number;
  skip?: number;
}

export interface AnalyticsQueryParams {
  startDate: string;
  endDate: string;
  timezone?: string;
}

// ============================================================================
// WebSocket Event Types
// ============================================================================

export interface WebSocketEvent {
  type: 'glucose' | 'treatment' | 'deviceStatus' | 'connection';
  data: any;
  timestamp: string;
}
