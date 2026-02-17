// ============================================================================
// Analytics Service - Advanced Glucose Statistics & Patterns
// ============================================================================

import type {
  GlucoseEntry,
  GlucoseStats,
  TimeInRange,
  DailyPattern,
  GlucoseAnalytics,
} from '../types/index.js';

// ============================================================================
// Statistical Calculations
// ============================================================================

function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = calculateMean(values);
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
  const variance = calculateMean(squaredDiffs);
  return Math.sqrt(variance);
}

// ============================================================================
// Glucose Statistics
// ============================================================================

export function calculateGlucoseStats(entries: GlucoseEntry[]): GlucoseStats {
  const values = entries.map((e) => e.sgv);

  if (values.length === 0) {
    return {
      average: 0,
      median: 0,
      min: 0,
      max: 0,
      stdDev: 0,
      cv: 0,
      gmi: 0,
      estimatedA1c: 0,
    };
  }

  const average = calculateMean(values);
  const median = calculateMedian(values);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const stdDev = calculateStdDev(values);

  // Coefficient of Variation (CV%) - should be < 36% for good control
  const cv = average > 0 ? (stdDev / average) * 100 : 0;

  // GMI (Glucose Management Indicator) - correlation with HbA1c
  // Formula: GMI = 3.31 + 0.02392 × average_glucose_mg/dL
  const gmi = 3.31 + 0.02392 * average;

  // Alternative A1c estimation (Nathan et al. formula)
  const estimatedA1c = (average + 46.7) / 28.7;

  return {
    average: Math.round(average * 10) / 10,
    median: Math.round(median * 10) / 10,
    min,
    max,
    stdDev: Math.round(stdDev * 10) / 10,
    cv: Math.round(cv * 10) / 10,
    gmi: Math.round(gmi * 100) / 100,
    estimatedA1c: Math.round(estimatedA1c * 100) / 100,
  };
}

// ============================================================================
// Time in Range (TIR) Calculations
// ============================================================================

export function calculateTimeInRange(entries: GlucoseEntry[]): TimeInRange {
  if (entries.length === 0) {
    return {
      veryLow: 0,
      low: 0,
      inRange: 0,
      high: 0,
      veryHigh: 0,
      percentVeryLow: 0,
      percentLow: 0,
      percentInRange: 0,
      percentHigh: 0,
      percentVeryHigh: 0,
    };
  }

  const total = entries.length;
  let veryLow = 0; // < 54 mg/dL
  let low = 0; // 54-70 mg/dL
  let inRange = 0; // 70-180 mg/dL (target range)
  let high = 0; // 180-250 mg/dL
  let veryHigh = 0; // > 250 mg/dL

  entries.forEach((entry) => {
    const sgv = entry.sgv;
    if (sgv < 54) veryLow++;
    else if (sgv < 70) low++;
    else if (sgv <= 180) inRange++;
    else if (sgv <= 250) high++;
    else veryHigh++;
  });

  return {
    veryLow,
    low,
    inRange,
    high,
    veryHigh,
    percentVeryLow: Math.round((veryLow / total) * 1000) / 10,
    percentLow: Math.round((low / total) * 1000) / 10,
    percentInRange: Math.round((inRange / total) * 1000) / 10,
    percentHigh: Math.round((high / total) * 1000) / 10,
    percentVeryHigh: Math.round((veryHigh / total) * 1000) / 10,
  };
}

// ============================================================================
// Daily Patterns (Hourly Averages)
// ============================================================================

export function calculateDailyPatterns(entries: GlucoseEntry[]): DailyPattern[] {
  // Group readings by hour of day (0-23)
  const hourlyData: { [hour: number]: number[] } = {};

  entries.forEach((entry) => {
    const date = new Date(entry.date);
    const hour = date.getHours();

    if (!hourlyData[hour]) {
      hourlyData[hour] = [];
    }
    hourlyData[hour].push(entry.sgv);
  });

  // Calculate statistics for each hour
  const patterns: DailyPattern[] = [];

  for (let hour = 0; hour < 24; hour++) {
    const values = hourlyData[hour] || [];
    patterns.push({
      hour,
      averageGlucose: values.length > 0 ? Math.round(calculateMean(values)) : 0,
      count: values.length,
      stdDev: values.length > 0 ? Math.round(calculateStdDev(values)) : 0,
    });
  }

  return patterns;
}

// ============================================================================
// Complete Analytics Report
// ============================================================================

export function generateAnalytics(
  entries: GlucoseEntry[],
  startDate: Date,
  endDate: Date
): GlucoseAnalytics {
  const daysDiff = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    period: {
      start: startDate,
      end: endDate,
      days: daysDiff,
    },
    stats: calculateGlucoseStats(entries),
    timeInRange: calculateTimeInRange(entries),
    dailyPatterns: calculateDailyPatterns(entries),
    totalReadings: entries.length,
  };
}

// ============================================================================
// Pattern Detection (Advanced Analysis)
// ============================================================================

export interface DetectedPattern {
  type: 'dawn_phenomenon' | 'post_meal_spike' | 'nocturnal_hypoglycemia' | 'high_variability';
  severity: 'low' | 'medium' | 'high';
  description: string;
  hours?: number[];
  averageGlucose?: number;
}

export function detectPatterns(entries: GlucoseEntry[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const dailyPatterns = calculateDailyPatterns(entries);

  // Dawn Phenomenon Detection (high glucose 4am-8am)
  const morningHours = dailyPatterns.filter((p) => p.hour >= 4 && p.hour <= 8);
  const morningAvg = calculateMean(morningHours.map((p) => p.averageGlucose));

  if (morningAvg > 140) {
    patterns.push({
      type: 'dawn_phenomenon',
      severity: morningAvg > 180 ? 'high' : morningAvg > 160 ? 'medium' : 'low',
      description: `Elevated glucose levels detected in early morning hours (${Math.round(morningAvg)} mg/dL avg)`,
      hours: morningHours.map((p) => p.hour),
      averageGlucose: Math.round(morningAvg),
    });
  }

  // Nocturnal Hypoglycemia Detection (low glucose 12am-6am)
  const nightHours = dailyPatterns.filter(
    (p) => (p.hour >= 0 && p.hour <= 6) || p.hour === 23
  );
  const nightLowCount = entries.filter((e) => {
    const hour = new Date(e.date).getHours();
    return ((hour >= 0 && hour <= 6) || hour === 23) && e.sgv < 70;
  }).length;

  if (nightLowCount > entries.length * 0.05) {
    patterns.push({
      type: 'nocturnal_hypoglycemia',
      severity: nightLowCount > entries.length * 0.1 ? 'high' : 'medium',
      description: `Frequent low glucose readings detected during night hours (${nightLowCount} occurrences)`,
      hours: nightHours.map((p) => p.hour),
    });
  }

  // High Variability Detection
  const stats = calculateGlucoseStats(entries);
  if (stats.cv > 40) {
    patterns.push({
      type: 'high_variability',
      severity: stats.cv > 50 ? 'high' : 'medium',
      description: `High glucose variability detected (CV: ${stats.cv.toFixed(1)}%, target: <36%)`,
    });
  }

  return patterns;
}
