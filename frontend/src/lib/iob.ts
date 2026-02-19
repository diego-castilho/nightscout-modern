// ============================================================================
// IOB — Insulin On Board calculation
// ============================================================================
// Uses the "bilinear" decay model (Nightscout default for rapid-acting insulin):
//   - Phase 1 (0 → peak): slower decay, insulin still ramping down from peak
//   - Phase 2 (peak → DIA): faster decay
//
// Peak is set at 75 min (standard for rapid-acting analogues like lispro/aspart).
// For DIA values < 2.5h the model collapses to simple linear decay.
//
// Formula (Walsh bilinear, unitless fraction remaining):
//   t ≤ peak : fraction = 1  - (t / DIA) * (1 / (2*(1 - peak/DIA)))
//   t > peak : fraction = (DIA - t) / (DIA - peak) * (peak / DIA) * 0.5
//
// Bolus treatments (Meal Bolus, Correction Bolus) are counted directly.
//
// Temp Basal is counted as the DEVIATION from the scheduled basal rate, modelled
// as a stream of 5-minute micro-boluses (standard Nightscout/Loop approach).
// Each micro-bolus has size  deviation_U/h × (5/60) h  and decays via iobFraction.
// IOB can be negative when a Temp Basal suspends or reduces the scheduled rate.
// Temp Basal IOB is only calculated when scheduledBasalRate > 0.
//
// Combo Bolus is counted in two parts:
//   - Immediate: standard bolus from created_at (iobFraction applied to full dose)
//   - Extended: micro-segments over `duration` minutes (always additive, not a deviation)
// ============================================================================

import type { Treatment } from './api';

const PEAK_MINUTES   = 75;          // rapid-acting insulin peak activity time
const SEGMENT_MS     = 5 * 60_000; // 5-minute micro-segment for Temp Basal

/**
 * Returns the fraction of a bolus dose still active at `elapsedMs` ms after injection.
 * Returns 0 outside the active window [0, diaMs].
 */
function iobFraction(elapsedMs: number, diaMs: number): number {
  if (elapsedMs <= 0 || elapsedMs >= diaMs) return 0;

  const elapsedH = elapsedMs / 3_600_000;
  const diaH     = diaMs   / 3_600_000;
  const peakH    = PEAK_MINUTES / 60;

  if (diaH <= peakH * 2) {
    // DIA too short for bilinear — simple linear decay
    return 1 - elapsedH / diaH;
  }

  if (elapsedH <= peakH) {
    // Phase 1: slower decay (still near peak)
    return 1 - (elapsedH / diaH) / (2 * (1 - peakH / diaH));
  } else {
    // Phase 2: faster decay toward zero at DIA
    return ((diaH - elapsedH) / (diaH - peakH)) * (peakH / diaH) * 0.5;
  }
}

/**
 * Calculates Temp Basal IOB as the sum of 5-minute deviation micro-boluses.
 * deviation = actualRate - scheduledBasalRate (can be negative for suspend/reduce).
 */
function calculateTempBasalIOB(
  treatments: Treatment[],
  diaMs: number,
  scheduledBasalRate: number,
): number {
  const now = Date.now();

  return treatments.reduce((total, t) => {
    if (t.eventType !== 'Temp Basal') return total;
    if (t.rate == null || !t.duration) return total;

    // Convert relative (%) to absolute U/h
    const actualRate = t.rateMode === 'relative'
      ? (t.rate / 100) * scheduledBasalRate
      : t.rate;

    const deviation = actualRate - scheduledBasalRate;
    if (Math.abs(deviation) < 0.001) return total; // negligible

    const startTime    = new Date(t.created_at).getTime();
    const endTime      = startTime + t.duration * 60_000;
    const deliveredEnd = Math.min(now, endTime);
    if (deliveredEnd <= startTime) return total;

    let iob = 0;
    for (let seg = startTime; seg < deliveredEnd; seg += SEGMENT_MS) {
      const segEnd      = Math.min(seg + SEGMENT_MS, deliveredEnd);
      const segMid      = (seg + segEnd) / 2;
      const segDuration = (segEnd - seg) / 3_600_000; // hours
      const segInsulin  = deviation * segDuration;     // U (positive or negative)
      const elapsed     = now - segMid;
      if (elapsed > 0) {
        iob += segInsulin * iobFraction(elapsed, diaMs);
      }
    }
    return total + iob;
  }, 0);
}

/**
 * Calculates Combo Bolus IOB from its two components:
 * - Immediate: full dose applied at created_at, decays normally
 * - Extended: delivered uniformly as 5-min micro-segments over `duration` minutes
 */
function calculateComboBolusIOB(treatments: Treatment[], diaMs: number): number {
  const now = Date.now();

  return treatments.reduce((total, t) => {
    if (t.eventType !== 'Combo Bolus') return total;

    const startTime = new Date(t.created_at).getTime();
    let iob = 0;

    // Immediate component
    if (t.immediateInsulin && t.immediateInsulin > 0) {
      const elapsed = now - startTime;
      if (elapsed > 0) {
        iob += t.immediateInsulin * iobFraction(elapsed, diaMs);
      }
    }

    // Extended component: micro-segments over duration
    if (t.extendedInsulin && t.extendedInsulin > 0 && t.duration) {
      const endTime      = startTime + t.duration * 60_000;
      const deliveredEnd = Math.min(now, endTime);
      if (deliveredEnd > startTime) {
        for (let seg = startTime; seg < deliveredEnd; seg += SEGMENT_MS) {
          const segEnd        = Math.min(seg + SEGMENT_MS, deliveredEnd);
          const segMid        = (seg + segEnd) / 2;
          const segDurationMin = (segEnd - seg) / 60_000;
          // Insulin per segment proportional to its duration fraction
          const segInsulin    = t.extendedInsulin * (segDurationMin / t.duration);
          const elapsed       = now - segMid;
          if (elapsed > 0) {
            iob += segInsulin * iobFraction(elapsed, diaMs);
          }
        }
      }
    }

    return total + iob;
  }, 0);
}

/**
 * Calculates total Insulin on Board from a list of treatments.
 *
 * Bolus IOB: rapid-acting insulin (Meal Bolus, Snack Bolus, Correction Bolus, Basal Pen Change).
 * Basal Insulin (long-acting MDI pen) is excluded — its peakless 24–42 h profile is
 * incompatible with the bilinear Walsh model and it is never counted as bolus IOB
 * in Nightscout / Loop / OpenAPS.
 * Temp Basal IOB: deviation model — only when scheduledBasalRate > 0.
 *
 * @param treatments         - list of recent treatments (covering at least `diaHours`)
 * @param diaHours           - Duration of Insulin Action in hours
 * @param scheduledBasalRate - Pump scheduled basal rate in U/h (0 = disabled)
 * @returns IOB in units (U), rounded to 2 decimal places (may be negative)
 */
export function calculateIOB(
  treatments: Treatment[],
  diaHours: number,
  scheduledBasalRate = 0,
): number {
  const now   = Date.now();
  const diaMs = diaHours * 3_600_000;

  const bolusIOB = treatments.reduce((sum, t) => {
    // Exclude long-acting basal insulin — incompatible pharmacokinetics
    if (t.eventType === 'Basal Insulin') return sum;
    // Exclude Combo Bolus — handled separately with two-phase model
    if (t.eventType === 'Combo Bolus')   return sum;
    const insulin = t.insulin;
    if (!insulin || insulin <= 0) return sum;
    const elapsed = now - new Date(t.created_at).getTime();
    return sum + insulin * iobFraction(elapsed, diaMs);
  }, 0);

  const comboIOB = calculateComboBolusIOB(treatments, diaMs);

  const basalIOB = scheduledBasalRate > 0
    ? calculateTempBasalIOB(treatments, diaMs, scheduledBasalRate)
    : 0;

  return Math.round((bolusIOB + comboIOB + basalIOB) * 100) / 100;
}
