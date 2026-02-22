// ============================================================================
// lib/weeklyAggregations.ts — Clinical data aggregation for weekly view
// ============================================================================
// Extracted from WeeklyPage so the logic is testable independently and can
// be reused by other report pages (e.g. monthly calendar).
// ============================================================================

import { startOfDay, endOfDay, addDays, format } from 'date-fns';
import type { GlucoseEntry, Treatment } from './api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type GlucoseZone = 'veryLow' | 'low' | 'inRange' | 'high' | 'veryHigh' | 'noData';

export interface WeeklyDaySummary {
  date: string;
  weekday: string;
  isFutureDay: boolean;
  hasGlucoseData: boolean;
  avgGlucose: number;
  minGlucose: number;
  maxGlucose: number;
  zone: GlucoseZone;
  tirPercent: number;
  hypoCount: number;
  sparkline: { t: number; v: number }[];
  totalCarbs: number;
  totalRapidInsulin: number;
  totalSlowInsulin: number;
  hasTreatmentData: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// WeeklyPage counts Combo Bolus components separately; Correction Bolus is
// included here and handled as a direct insulin field.
const RAPID_BOLUS_TYPES = ['Meal Bolus', 'Snack Bolus', 'Correction Bolus'];
const SLOW_BOLUS_TYPES  = ['Basal Insulin'];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Maps a glucose value to its clinical zone.
 * Returns 'noData' when avg is 0 (no readings available).
 */
export function glucoseZone(
  avg: number,
  t: { veryLow: number; low: number; high: number; veryHigh: number },
): GlucoseZone {
  if (avg === 0)         return 'noData';
  if (avg < t.veryLow)  return 'veryLow';
  if (avg < t.low)      return 'low';
  if (avg <= t.high)    return 'inRange';
  if (avg <= t.veryHigh) return 'high';
  return 'veryHigh';
}

// ── Aggregation ───────────────────────────────────────────────────────────────

/**
 * Aggregates glucose entries and treatments into a 7-day summary array,
 * starting from `weekStart` (typically Monday of the selected ISO week).
 */
export function aggregateWeek(
  entries: GlucoseEntry[],
  treatments: Treatment[],
  weekStart: Date,
  thresholds: { veryLow: number; low: number; high: number; veryHigh: number },
): WeeklyDaySummary[] {
  return Array.from({ length: 7 }, (_, i) => {
    const dayStart = startOfDay(addDays(weekStart, i));
    const dayEnd   = endOfDay(dayStart);
    const dateStr  = format(dayStart, 'yyyy-MM-dd');
    const weekday  = WEEKDAYS_SHORT[dayStart.getDay()];
    const dayIsFuture = dayStart > new Date();

    const dayEntries = entries
      .filter(e => e.date >= dayStart.getTime() && e.date <= dayEnd.getTime())
      .sort((a, b) => a.date - b.date);

    const dayTreatments = treatments.filter(t => {
      const tTime = new Date(t.created_at).getTime();
      return tTime >= dayStart.getTime() && tTime <= dayEnd.getTime();
    });

    let totalCarbs = 0;
    let totalRapidInsulin = 0;
    let totalSlowInsulin  = 0;
    for (const t of dayTreatments) {
      if (t.carbs) totalCarbs += t.carbs;
      if (RAPID_BOLUS_TYPES.includes(t.eventType)) {
        totalRapidInsulin += t.insulin ?? 0;
      } else if (t.eventType === 'Combo Bolus') {
        totalRapidInsulin += (t.immediateInsulin ?? 0) + (t.extendedInsulin ?? 0);
      } else if (SLOW_BOLUS_TYPES.includes(t.eventType)) {
        totalSlowInsulin += t.insulin ?? 0;
      }
    }

    const round1 = (n: number) => Math.round(n * 10) / 10;

    if (dayEntries.length === 0) {
      return {
        date: dateStr,
        weekday,
        isFutureDay: dayIsFuture,
        hasGlucoseData: false,
        avgGlucose: 0,
        minGlucose: 0,
        maxGlucose: 0,
        zone: 'noData' as GlucoseZone,
        tirPercent: 0,
        hypoCount: 0,
        sparkline: [],
        totalCarbs: round1(totalCarbs),
        totalRapidInsulin: round1(totalRapidInsulin),
        totalSlowInsulin: round1(totalSlowInsulin),
        hasTreatmentData: dayTreatments.length > 0,
      };
    }

    const sgvs         = dayEntries.map(e => e.sgv);
    const avg          = Math.round(sgvs.reduce((a, b) => a + b, 0) / sgvs.length);
    const min          = Math.min(...sgvs);
    const max          = Math.max(...sgvs);
    const inRangeCount = dayEntries.filter(e => e.sgv >= thresholds.low && e.sgv <= thresholds.high).length;
    const tirPercent   = Math.round((inRangeCount / dayEntries.length) * 100);
    const hypoCount    = dayEntries.filter(e => e.sgv < thresholds.low).length;
    const zone         = glucoseZone(avg, thresholds);

    return {
      date: dateStr,
      weekday,
      isFutureDay: dayIsFuture,
      hasGlucoseData: true,
      avgGlucose: avg,
      minGlucose: min,
      maxGlucose: max,
      zone,
      tirPercent,
      hypoCount,
      sparkline: dayEntries.map(e => ({ t: e.date, v: e.sgv })),
      totalCarbs: round1(totalCarbs),
      totalRapidInsulin: round1(totalRapidInsulin),
      totalSlowInsulin: round1(totalSlowInsulin),
      hasTreatmentData: dayTreatments.length > 0,
    };
  });
}
