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
// Only bolus treatments are counted (Meal Bolus and Correction Bolus).
// ============================================================================

import type { Treatment } from './api';

const PEAK_MINUTES = 75; // rapid-acting insulin peak activity time

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
 * Calculates total Insulin on Board from a list of treatments.
 * Only treatments with insulin > 0 are counted (Meal Bolus, Correction Bolus).
 *
 * @param treatments - list of recent treatments (at least `diaHours` old)
 * @param diaHours   - Duration of Insulin Action in hours
 * @returns IOB in units (U), rounded to 2 decimal places
 */
export function calculateIOB(treatments: Treatment[], diaHours: number): number {
  const now   = Date.now();
  const diaMs = diaHours * 3_600_000;

  const total = treatments.reduce((sum, t) => {
    const insulin = t.insulin;
    if (!insulin || insulin <= 0) return sum;

    const elapsed = now - new Date(t.created_at).getTime();
    return sum + insulin * iobFraction(elapsed, diaMs);
  }, 0);

  return Math.round(total * 100) / 100;
}
