// ============================================================================
// Alarm Types — shared between evaluator, pushService and subscriptionStore
// ============================================================================

export type AlarmLevel = 'urgent' | 'warning';

export type AlarmType =
  | 'VERY_LOW'
  | 'LOW'
  | 'HIGH'
  | 'VERY_HIGH'
  | 'PREDICTED_LOW'
  | 'PREDICTED_HIGH'
  | 'STALE'
  | 'RAPID_FALL'
  | 'RAPID_RISE';

export interface AlarmEvent {
  type:      AlarmType;
  level:     AlarmLevel;
  sgv?:      number;   // current glucose (mg/dL); undefined for STALE
  message:   string;
  timestamp: number;   // Date.now()
}

export interface AlarmThresholds {
  veryLow:  number;
  low:      number;
  high:     number;
  veryHigh: number;
}

export interface AlarmConfig {
  enabled:      boolean;  // master switch
  veryLow:      boolean;
  low:          boolean;
  high:         boolean;
  veryHigh:     boolean;
  predictive:   boolean;
  stale:        boolean;
  staleMins:    number;
  rapidChange:  boolean;
}

export const DEFAULT_ALARM_CONFIG: AlarmConfig = {
  enabled:     false,
  veryLow:     true,
  low:         true,
  high:        true,
  veryHigh:    true,
  predictive:  true,
  stale:       true,
  staleMins:   15,
  rapidChange: false,
};
