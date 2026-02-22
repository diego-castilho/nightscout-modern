// ============================================================================
// lib/treatments.ts — Treatment categorisation helpers
// ============================================================================
// Extracted from DailyLogPage so any component that needs to classify or
// display a treatment label can import from here instead of duplicating.
// ============================================================================

import type { Treatment } from './api';

// Rapid (bolus) insulin event types — Combo Bolus handled here too
export const RAPID_TYPES = new Set([
  'Meal Bolus', 'Snack Bolus', 'Correction Bolus', 'Combo Bolus',
]);

// Long-acting (basal) insulin event types
export const SLOW_TYPES = new Set(['Basal Insulin']);

export function treatmentCategory(t: Treatment): 'rapid' | 'slow' | 'carbs' | 'other' {
  if (RAPID_TYPES.has(t.eventType)) return 'rapid';
  if (SLOW_TYPES.has(t.eventType))  return 'slow';
  if ((t.carbs ?? 0) > 0)           return 'carbs';
  return 'other';
}

export function treatmentLabel(t: Treatment): string {
  const cat = treatmentCategory(t);
  if (cat === 'rapid') {
    const dose = (t.insulin ?? 0) + (t.immediateInsulin ?? 0) + (t.extendedInsulin ?? 0);
    return dose > 0 ? `${Math.round(dose * 10) / 10}U` : '';
  }
  if (cat === 'slow')  return t.insulin ? `${t.insulin}U` : '';
  if (cat === 'carbs') return t.carbs   ? `${t.carbs}g`   : '';
  return '';
}
