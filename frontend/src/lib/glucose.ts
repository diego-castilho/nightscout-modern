// ============================================================================
// glucose.ts - Unit conversion utilities for glucose values
//
// Rule: the store and API always use mg/dL.
// Conversion to mmol/L happens only in the display layer.
// ============================================================================

export type GlucoseUnit = 'mgdl' | 'mmol';

export const MMOL_FACTOR = 18.01;

/** Convert a mg/dL value to the selected display unit. */
export function toDisplayUnit(mgdl: number, unit: GlucoseUnit): number {
  if (unit === 'mmol') return Math.round((mgdl / MMOL_FACTOR) * 10) / 10;
  return mgdl;
}

/** Convert a value in the selected display unit back to mg/dL (for storage). */
export function fromDisplayUnit(value: number, unit: GlucoseUnit): number {
  if (unit === 'mmol') return Math.round(value * MMOL_FACTOR);
  return Math.round(value);
}

/**
 * Format a mg/dL value for display in the selected unit.
 * mmol/L: 1 decimal place. mg/dL: integer string.
 */
export function formatGlucose(mgdl: number, unit: GlucoseUnit): string {
  if (unit === 'mmol') return (mgdl / MMOL_FACTOR).toFixed(1);
  return Math.round(mgdl).toString();
}

/** Human-readable unit label. */
export function unitLabel(unit: GlucoseUnit): string {
  return unit === 'mmol' ? 'mmol/L' : 'mg/dL';
}
