// ============================================================================
// lib/glucoseColors.ts — Single source of truth for glucose zone colours
// ============================================================================
// All chart components read colours from here via CSS custom properties.
// The actual colour values live in index.css under :root so that a future
// user-customisation feature only needs to update those variables at runtime:
//
//   document.documentElement.style.setProperty('--glucose-low', userColour);
//
// No component code needs to change for user-defined colour schemes.
// ============================================================================

/** CSS variable references for each glucose zone. */
export const GLUCOSE_COLORS = {
  veryLow:  'var(--glucose-very-low)',
  low:      'var(--glucose-low)',
  inRange:  'var(--glucose-in-range)',
  high:     'var(--glucose-high)',
  veryHigh: 'var(--glucose-very-high)',
  noData:   'var(--glucose-no-data)',
} as const;

export type GlucoseZoneKey = keyof typeof GLUCOSE_COLORS;
