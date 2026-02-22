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

function calculatePercentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const index = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return Math.round(sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight);
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

export interface TIRThresholds {
  veryLow?: number;  // mg/dL, default 54
  low?: number;      // mg/dL, default 70
  high?: number;     // mg/dL, default 180
  veryHigh?: number; // mg/dL, default 250
}

export function calculateTimeInRange(entries: GlucoseEntry[], thresholds: TIRThresholds = {}): TimeInRange {
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

  const tVeryLow  = thresholds.veryLow  ?? 54;
  const tLow      = thresholds.low      ?? 70;
  const tHigh     = thresholds.high     ?? 180;
  const tVeryHigh = thresholds.veryHigh ?? 250;

  const total = entries.length;
  let veryLow = 0;
  let low = 0;
  let inRange = 0;
  let high = 0;
  let veryHigh = 0;

  entries.forEach((entry) => {
    const sgv = entry.sgv;
    if (sgv < tVeryLow) veryLow++;
    else if (sgv < tLow) low++;
    else if (sgv <= tHigh) inRange++;
    else if (sgv <= tVeryHigh) high++;
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
    const sorted = [...values].sort((a, b) => a - b);
    patterns.push({
      hour,
      averageGlucose: values.length > 0 ? Math.round(calculateMean(values)) : 0,
      median: values.length > 0 ? calculatePercentile(sorted, 50) : 0,
      count: values.length,
      stdDev: values.length > 0 ? Math.round(calculateStdDev(values)) : 0,
      min: sorted.length > 0 ? sorted[0] : 0,
      max: sorted.length > 0 ? sorted[sorted.length - 1] : 0,
      p5: calculatePercentile(sorted, 5),
      p25: calculatePercentile(sorted, 25),
      p75: calculatePercentile(sorted, 75),
      p95: calculatePercentile(sorted, 95),
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
  endDate: Date,
  thresholds: TIRThresholds = {}
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
    timeInRange: calculateTimeInRange(entries, thresholds),
    dailyPatterns: calculateDailyPatterns(entries),
    totalReadings: entries.length,
  };
}

// ============================================================================
// Calendar Data (Monthly View)
// ============================================================================

export interface CalendarDayData {
  date: string;        // "YYYY-MM-DD"
  avgGlucose: number;  // mg/dL arredondado
  minGlucose: number;
  maxGlucose: number;
  readings: number;
  hypoCount: number;   // leituras < thresholds.low
  hypoSevere: number;  // leituras < thresholds.veryLow
  zone: 'veryLow' | 'low' | 'inRange' | 'high' | 'veryHigh' | 'noData';
}

function glucoseZone(
  avg: number,
  thresholds: Required<TIRThresholds>
): CalendarDayData['zone'] {
  if (avg < thresholds.veryLow) return 'veryLow';
  if (avg < thresholds.low)     return 'low';
  if (avg <= thresholds.high)   return 'inRange';
  if (avg <= thresholds.veryHigh) return 'high';
  return 'veryHigh';
}

export function calculateCalendarData(
  entries: GlucoseEntry[],
  startDate: Date,
  thresholds: TIRThresholds = {}
): CalendarDayData[] {
  const tVeryLow  = thresholds.veryLow  ?? 54;
  const tLow      = thresholds.low      ?? 70;
  const tHigh     = thresholds.high     ?? 180;
  const tVeryHigh = thresholds.veryHigh ?? 250;
  const t: Required<TIRThresholds> = { veryLow: tVeryLow, low: tLow, high: tHigh, veryHigh: tVeryHigh };

  // Agrupar por dayIndex relativo ao startDate (timezone-safe)
  const byDay = new Map<number, number[]>();
  for (const entry of entries) {
    const dayIndex = Math.floor((entry.date - startDate.getTime()) / 86_400_000);
    if (dayIndex < 0) continue;
    if (!byDay.has(dayIndex)) byDay.set(dayIndex, []);
    byDay.get(dayIndex)!.push(entry.sgv);
  }

  const days = byDay.size > 0 ? Math.max(...byDay.keys()) + 1 : 0;
  const result: CalendarDayData[] = [];

  for (let i = 0; i < days; i++) {
    const values = byDay.get(i);
    const dateStr = new Date(startDate.getTime() + i * 86_400_000)
      .toISOString()
      .slice(0, 10);

    if (!values || values.length === 0) {
      result.push({ date: dateStr, avgGlucose: 0, minGlucose: 0, maxGlucose: 0, readings: 0, hypoCount: 0, hypoSevere: 0, zone: 'noData' });
      continue;
    }

    const avg  = Math.round(calculateMean(values));
    const min  = Math.min(...values);
    const max  = Math.max(...values);
    const hypo = values.filter(v => v < tLow).length;
    const sev  = values.filter(v => v < tVeryLow).length;

    result.push({
      date: dateStr,
      avgGlucose: avg,
      minGlucose: min,
      maxGlucose: max,
      readings: values.length,
      hypoCount: hypo,
      hypoSevere: sev,
      zone: glucoseZone(avg, t),
    });
  }

  return result;
}

// ============================================================================
// Distribution & Advanced Variability Metrics (Fase 4)
// ============================================================================

export interface HistogramBin {
  bin: number;     // lower bound in mg/dL (e.g. 40, 50, 60, …)
  count: number;
  percent: number; // 0–100
}

export interface DistributionStats {
  totalReadings: number;
  gvi: number;                   // Glycemic Variability Index
  pgs: number;                   // Patient Glycemic Status
  jIndex: number;                // J-Index = 0.001 × (mean + stdDev)²
  iqr: number;                   // Interquartile Range (P75 - P25) mg/dL
  meanDailyChange: number;       // Mean |daily_avg[i] - daily_avg[i-1]| mg/dL
  outOfRangeRms: number;         // RMS distance from boundary for OOR readings
  timeInFluctuation: number;     // % intervals |Δg/Δt| > 1 mg/dL/min
  timeInRapidFluctuation: number;// % intervals |Δg/Δt| > 2 mg/dL/min
  histogram: HistogramBin[];
}

export function calculateDistributionStats(
  entries: GlucoseEntry[],
  thresholds: TIRThresholds = {}
): DistributionStats {
  const tLow  = thresholds.low  ?? 70;
  const tHigh = thresholds.high ?? 180;
  const total = entries.length;

  const empty: DistributionStats = {
    totalReadings: 0, gvi: 0, pgs: 0, jIndex: 0, iqr: 0,
    meanDailyChange: 0, outOfRangeRms: 0,
    timeInFluctuation: 0, timeInRapidFluctuation: 0, histogram: [],
  };
  if (total === 0) return empty;

  // Sort by timestamp ascending
  const sorted = [...entries].sort((a, b) => a.date - b.date);
  const values = sorted.map((e) => e.sgv);
  const sortedVals = [...values].sort((a, b) => a - b);

  // Basic stats
  const mean   = calculateMean(values);
  const stdDev = calculateStdDev(values);
  const p25    = calculatePercentile(sortedVals, 25);
  const p75    = calculatePercentile(sortedVals, 75);
  const iqr    = p75 - p25;

  // J-Index
  const jIndex = Math.round(0.001 * Math.pow(mean + stdDev, 2) * 100) / 100;

  // GVI + fluctuation metrics — iterate consecutive pairs
  let actualPath    = 0;
  let idealDuration = 0; // minutes (sum of short segments)
  let fluctCount    = 0;
  let rapidCount    = 0;
  let intervalCount = 0;

  for (let i = 1; i < sorted.length; i++) {
    const dtMs  = sorted[i].date - sorted[i - 1].date;
    const dtMin = dtMs / 60_000;
    const dg    = sorted[i].sgv - sorted[i - 1].sgv;

    // GVI path: skip sensor gaps > 20 min
    if (dtMin > 0 && dtMin <= 20) {
      actualPath    += Math.sqrt(dtMin * dtMin + dg * dg);
      idealDuration += dtMin;
    }

    // Fluctuation: only valid for intervals ≤ 15 min
    if (dtMin > 0 && dtMin <= 15) {
      intervalCount++;
      const rate = Math.abs(dg) / dtMin;
      if (rate > 1) fluctCount++;
      if (rate > 2) rapidCount++;
    }
  }

  // GVI = actual path length / ideal straight-line path (constant glucose)
  // Ideal path for a constant signal over `idealDuration` minutes is just `idealDuration`
  const gvi = idealDuration > 0
    ? Math.round((actualPath / idealDuration) * 100) / 100
    : 1;

  // PGS = GVI × % time out of range
  const oorCount = values.filter((v) => v < tLow || v > tHigh).length;
  const torPct   = (oorCount / total) * 100;
  const pgs      = Math.round(gvi * torPct * 100) / 100;

  // Time in fluctuation
  const timeInFluctuation      = intervalCount > 0
    ? Math.round((fluctCount  / intervalCount) * 1000) / 10
    : 0;
  const timeInRapidFluctuation = intervalCount > 0
    ? Math.round((rapidCount  / intervalCount) * 1000) / 10
    : 0;

  // Out-of-range RMS — distance from nearest boundary for OOR readings
  let outOfRangeRms = 0;
  if (oorCount > 0) {
    const sumSq = values
      .filter((v) => v < tLow || v > tHigh)
      .reduce((acc, v) => {
        const dist = v < tLow ? tLow - v : v - tHigh;
        return acc + dist * dist;
      }, 0);
    outOfRangeRms = Math.round(Math.sqrt(sumSq / oorCount) * 10) / 10;
  }

  // Mean Daily Change — daily averages, then mean of absolute day-to-day differences
  const byDay = new Map<string, number[]>();
  for (const entry of sorted) {
    const key = new Date(entry.date).toISOString().slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(entry.sgv);
  }
  const dailyAvgs = [...byDay.values()].map((vs) => calculateMean(vs));
  let meanDailyChange = 0;
  if (dailyAvgs.length > 1) {
    const changes: number[] = [];
    for (let i = 1; i < dailyAvgs.length; i++) {
      changes.push(Math.abs(dailyAvgs[i] - dailyAvgs[i - 1]));
    }
    meanDailyChange = Math.round(calculateMean(changes) * 10) / 10;
  }

  // Histogram — 10 mg/dL bins from 40 to 400
  // Single O(n) pass: compute bin index directly instead of 36 × filter()
  const HIST_MIN  = 40;
  const HIST_STEP = 10;
  const HIST_N    = 36; // (400 - 40) / 10
  const counts    = new Int32Array(HIST_N);
  for (const v of values) {
    const i = Math.floor((v - HIST_MIN) / HIST_STEP);
    if (i >= 0 && i < HIST_N) counts[i]++;
  }
  const histogram: HistogramBin[] = Array.from({ length: HIST_N }, (_, i) => ({
    bin:     HIST_MIN + i * HIST_STEP,
    count:   counts[i],
    percent: Math.round((counts[i] / total) * 1000) / 10,
  }));

  return {
    totalReadings: total,
    gvi,
    pgs,
    jIndex,
    iqr,
    meanDailyChange,
    outOfRangeRms,
    timeInFluctuation,
    timeInRapidFluctuation,
    histogram,
  };
}

// ============================================================================
// Meal Correlation (Fase 6 — Padrões de Refeição)
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

const PERIOD_LABELS: Record<MealPeriod, string> = {
  cafe_manha: 'Café da Manhã',
  almoco:     'Almoço',
  lanche:     'Lanche',
  jantar:     'Jantar',
  outro:      'Outro',
};

function inferMealPeriod(hour: number, mealType?: string): MealPeriod {
  if (
    mealType === 'almoco' || mealType === 'jantar' ||
    mealType === 'cafe_manha' || mealType === 'lanche'
  ) {
    return mealType as MealPeriod;
  }
  if (hour >= 5  && hour < 10) return 'cafe_manha';
  if (hour >= 11 && hour < 15) return 'almoco';
  if (hour >= 15 && hour < 19) return 'lanche';
  if (hour >= 19 && hour < 24) return 'jantar';
  return 'outro';
}

// Binary search: nearest glucose reading within ±windowMs of targetTs
function nearestGlucose(
  sorted: GlucoseEntry[],
  targetTs: number,
  windowMs: number
): number | null {
  let lo = 0, hi = sorted.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid].date < targetTs) lo = mid + 1;
    else hi = mid;
  }
  let best: number | null = null;
  let bestDist = Infinity;
  for (const idx of [lo - 1, lo]) {
    if (idx < 0 || idx >= sorted.length) continue;
    const dist = Math.abs(sorted[idx].date - targetTs);
    if (dist <= windowMs && dist < bestDist) {
      bestDist = dist;
      best = sorted[idx].sgv;
    }
  }
  return best;
}

// Binary search: max glucose in [startTs, endTs]
function maxGlucoseInRange(
  sorted: GlucoseEntry[],
  startTs: number,
  endTs: number
): number | null {
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid].date < startTs) lo = mid + 1;
    else hi = mid;
  }
  let max: number | null = null;
  for (let i = lo; i < sorted.length && sorted[i].date <= endTs; i++) {
    if (max === null || sorted[i].sgv > max) max = sorted[i].sgv;
  }
  return max;
}

export function correlateMeals(
  entries: GlucoseEntry[],
  treatments: import('../types/index.js').Treatment[]
): MealtimeData {
  const MEAL_TYPES = new Set(['Meal Bolus', 'Snack Bolus', 'Carb Correction']);
  const mealTreatments = treatments.filter((t) => MEAL_TYPES.has(t.eventType));

  if (mealTreatments.length === 0) return { periods: [], totalEvents: 0 };

  // Entries sorted ascending by date (required for binary search)
  const sorted = [...entries].sort((a, b) => a.date - b.date);

  const WINDOW_MS = 10 * 60_000;      // ±10 min for point-in-time lookup
  const H1_MS     = 60 * 60_000;      // 1 h
  const H2_MS     = 2 * 60 * 60_000;  // 2 h
  const PEAK_MS   = 3 * 60 * 60_000;  // 3 h window for peak search

  const eventMap = new Map<MealPeriod, MealEvent[]>();

  for (const t of mealTreatments) {
    const ts = new Date(t.created_at || t.timestamp || '').getTime();
    if (isNaN(ts)) continue;

    const hour      = new Date(ts).getHours();
    const period    = inferMealPeriod(hour, t.mealType);
    const preMeal   = nearestGlucose(sorted, ts, WINDOW_MS);
    const at1h      = nearestGlucose(sorted, ts + H1_MS, WINDOW_MS);
    const at2h      = nearestGlucose(sorted, ts + H2_MS, WINDOW_MS);
    const peak      = maxGlucoseInRange(sorted, ts, ts + PEAK_MS);
    const peakDelta = (preMeal !== null && peak !== null) ? peak - preMeal : null;

    const event: MealEvent = {
      treatmentId:    t._id,
      eventType:      t.eventType,
      mealType:       period,
      timestamp:      ts,
      hour,
      carbs:          t.carbs   ?? 0,
      insulin:        t.insulin ?? 0,
      preMealGlucose: preMeal,
      glucoseAt1h:    at1h,
      glucoseAt2h:    at2h,
      peakGlucose:    peak,
      peakDelta,
    };

    if (!eventMap.has(period)) eventMap.set(period, []);
    eventMap.get(period)!.push(event);
  }

  const avgOrZero = (arr: (number | null)[]): number => {
    const valid = arr.filter((v): v is number => v !== null);
    return valid.length > 0 ? Math.round(calculateMean(valid)) : 0;
  };

  const ORDER: MealPeriod[] = ['cafe_manha', 'almoco', 'lanche', 'jantar', 'outro'];
  const periods: MealPeriodStats[] = [];

  for (const p of ORDER) {
    const evs = eventMap.get(p);
    if (!evs || evs.length === 0) continue;
    periods.push({
      period:     p,
      label:      PERIOD_LABELS[p],
      count:      evs.length,
      avgPreMeal: avgOrZero(evs.map((e) => e.preMealGlucose)),
      avgAt1h:    avgOrZero(evs.map((e) => e.glucoseAt1h)),
      avgAt2h:    avgOrZero(evs.map((e) => e.glucoseAt2h)),
      avgPeak:    avgOrZero(evs.map((e) => e.peakGlucose)),
      avgDelta:   avgOrZero(evs.map((e) => e.peakDelta)),
      avgCarbs:   Math.round(calculateMean(evs.map((e) => e.carbs))),
      avgInsulin: Math.round(calculateMean(evs.map((e) => e.insulin)) * 10) / 10,
      events:     evs.sort((a, b) => b.timestamp - a.timestamp),
    });
  }

  return { periods, totalEvents: mealTreatments.length };
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
