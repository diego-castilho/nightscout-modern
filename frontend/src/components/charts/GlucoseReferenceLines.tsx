// ============================================================================
// GlucoseReferenceLines — Standard Y-axis threshold lines for Recharts charts
// ============================================================================
// Drop-in replacement for the repeated <ReferenceLine> blocks that appear in
// ~7 chart files. Colours are read from CSS custom properties defined in
// index.css so a future user-customisation feature only needs to update those
// variables — no component code changes required.
//
// Usage (inside a Recharts <ComposedChart> or <LineChart>):
//   <GlucoseReferenceLines thresholds={alarmThresholds} unit={unit} />
//   <GlucoseReferenceLines thresholds={...} unit={unit} which={['low','high']} showLabels={false} />
// ============================================================================

import { ReferenceLine, Label } from 'recharts';
import { formatGlucose } from '../../lib/glucose';

// ── Zone config ───────────────────────────────────────────────────────────────
// All threshold lines share the same dotted "3 3" pattern and strokeWidth 1.5
// so every chart has a consistent visual language. Colours differ per zone.

const ZONE_CONFIG = {
  veryLow:  { color: 'var(--glucose-very-low)',  strokeWidth: 1.5, dashArray: '3 3' },
  low:      { color: 'var(--glucose-low)',        strokeWidth: 1.5, dashArray: '3 3' },
  high:     { color: 'var(--glucose-high)',       strokeWidth: 1.5, dashArray: '3 3' },
  veryHigh: { color: 'var(--glucose-very-high)', strokeWidth: 1.5, dashArray: '3 3' },
} as const;

// ── Component ─────────────────────────────────────────────────────────────────

type ZoneKey = keyof typeof ZONE_CONFIG;

interface GlucoseReferenceLinesProps {
  thresholds: { veryLow: number; low: number; high: number; veryHigh: number };
  unit: 'mgdl' | 'mmol';
  /** Show value labels on the right side. Default: true */
  showLabels?: boolean;
  /** Which threshold lines to render. Default: all four */
  which?: ZoneKey[];
}

const DEFAULT_WHICH: ZoneKey[] = ['veryLow', 'low', 'high', 'veryHigh'];

export function GlucoseReferenceLines({
  thresholds,
  unit,
  showLabels = true,
  which = DEFAULT_WHICH,
}: GlucoseReferenceLinesProps) {
  return (
    <>
      {which.map((zone) => {
        const cfg   = ZONE_CONFIG[zone];
        const value = thresholds[zone];

        return (
          <ReferenceLine
            key={zone}
            y={value}
            stroke={cfg.color}
            strokeWidth={cfg.strokeWidth}
            strokeDasharray={cfg.dashArray}
          >
            {showLabels && (
              <Label
                value={formatGlucose(value, unit)}
                position="right"
                fontSize={10}
                fill={cfg.color}
                offset={4}
              />
            )}
          </ReferenceLine>
        );
      })}
    </>
  );
}
