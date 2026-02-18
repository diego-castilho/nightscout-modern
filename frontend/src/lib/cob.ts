// ============================================================================
// COB — Carbs on Board calculation
// ============================================================================
// Uses linear absorption: each meal is fully absorbed in
//   absorptionTime = carbs (g) / carbAbsorptionRate (g/h)
//
// This matches Nightscout's minimum absorption rate model. The absorption
// rate reflects how fast the gut delivers glucose to the bloodstream, not
// insulin sensitivity. Typical values: 20-30 g/h for standard carbs.
//
// Only treatments with carbs > 0 are counted:
//   - Meal Bolus    (refeição com carboidratos)
//   - Carb Correction (correção só de carbos)
// ============================================================================

import type { Treatment } from './api';

/**
 * Calculates total Carbs on Board from a list of treatments.
 *
 * @param treatments         - list of recent treatments
 * @param carbAbsorptionRate - absorption rate in g/hour (e.g. 30)
 * @returns COB in grams, rounded to 1 decimal place
 */
export function calculateCOB(
  treatments: Treatment[],
  carbAbsorptionRate: number,
): number {
  if (carbAbsorptionRate <= 0) return 0;

  const now = Date.now();

  const total = treatments.reduce((sum, t) => {
    const carbs = t.carbs;
    if (!carbs || carbs <= 0) return sum;

    const elapsed    = now - new Date(t.created_at).getTime();
    const absorptionMs = (carbs / carbAbsorptionRate) * 3_600_000;

    if (elapsed <= 0 || elapsed >= absorptionMs) return sum;

    // Linear decay: 100% at t=0, 0% at t=absorptionTime
    const fraction = 1 - elapsed / absorptionMs;
    return sum + carbs * fraction;
  }, 0);

  return Math.round(total * 10) / 10;
}
