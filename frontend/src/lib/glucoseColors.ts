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

/** CSS variable references for each glucose zone.
 *  Use in Recharts stroke/fill props and CSS-capable attributes. */
export const GLUCOSE_COLORS = {
  veryLow:  'var(--glucose-very-low)',
  low:      'var(--glucose-low)',
  inRange:  'var(--glucose-in-range)',
  high:     'var(--glucose-high)',
  veryHigh: 'var(--glucose-very-high)',
  noData:   'var(--glucose-no-data)',
} as const;

/** Hex equivalents — must match the oklch values in index.css.
 *  Required for SVG attributes (gradient stops, plain SVG elements) which
 *  cannot resolve CSS custom properties at the attribute level.
 *  Tailwind v4.2 palette:
 *    veryLow  = Red 700   oklch(50.5% 0.213  27.518)
 *    low      = Red 500   oklch(63.7% 0.237  25.331)
 *    inRange  = Green 500 oklch(72.3% 0.219 149.579)
 *    high     = Amber 500 oklch(76.9% 0.188  70.08)
 *    veryHigh = Orange 500 oklch(70.5% 0.213  47.604)
 *    noData   = Zinc 500  oklch(55.1% 0.023 264.364) */
export const GLUCOSE_HEX = {
  veryLow:  '#b91c1c',
  low:      '#ef4444',
  inRange:  '#22c55e',
  high:     '#f59e0b',
  veryHigh: '#f97316',
  noData:   '#71717a',
} as const;

export type GlucoseZoneKey = keyof typeof GLUCOSE_COLORS;
