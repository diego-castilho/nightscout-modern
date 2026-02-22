// ============================================================================
// BoxPlotChart — Hourly glucose box plots (SVG, no Recharts overhead)
// ============================================================================
// Extracted from HourlyStatsPage so it can be tested and reused independently.
// ============================================================================

import type { DailyPattern } from '../../lib/api';
import { glucoseZone } from '../../lib/weeklyAggregations';
import type { GlucoseZone } from '../../lib/weeklyAggregations';

// ── Layout constants ──────────────────────────────────────────────────────────

const BP_LEFT  = 42;   // Y-axis label space (px)
const BP_TOP   = 8;
const BP_BOT   = 22;   // X-axis label space (px)
const BP_RIGHT = 4;
const COL_W    = 27;   // px per hour column  (24 * 27 = 648 px inner)
const BOX_HW   = 8;    // box half-width
const Y_MIN    = 40;
const Y_MAX    = 400;
const IH       = 180;  // inner chart height
const IW       = 24 * COL_W;
const SVG_W    = BP_LEFT + IW + BP_RIGHT;
const SVG_H    = BP_TOP + IH + BP_BOT;

const Y_TICKS  = [54, 70, 100, 140, 180, 250, 300, 350];
const X_LABELS = [0, 3, 6, 9, 12, 15, 18, 21];

function yOf(v: number): number {
  return BP_TOP + IH - ((Math.min(Y_MAX, Math.max(Y_MIN, v)) - Y_MIN) / (Y_MAX - Y_MIN)) * IH;
}

// Hardcoded hex colours are required here because we use them as SVG
// attribute values AND as hex alpha composites (col + '44').
// When user-customisable colours land, replace these with
// getComputedStyle(document.documentElement).getPropertyValue('--glucose-*')
// at render time.
const ZONE_COLOR: Record<GlucoseZone, string> = {
  inRange:  '#22c55e',
  high:     '#f59e0b',
  veryHigh: '#ef4444',
  low:      '#f97316',
  veryLow:  '#dc2626',
  noData:   '#6b7280',
};

// ── Component ─────────────────────────────────────────────────────────────────

interface BoxPlotChartProps {
  data: DailyPattern[];
  thresholds: { veryLow: number; low: number; high: number; veryHigh: number };
}

export function BoxPlotChart({ data, thresholds }: BoxPlotChartProps) {
  const yLow      = yOf(thresholds.low);
  const yHigh     = yOf(thresholds.high);
  const yVeryLow  = yOf(thresholds.veryLow);
  const yVeryHigh = yOf(thresholds.veryHigh);
  const yBottom   = BP_TOP + IH;

  return (
    <div className="overflow-x-auto">
      <svg
        width={SVG_W}
        height={SVG_H}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{ display: 'block' }}
      >
        {/* Zone background bands */}
        <rect x={BP_LEFT} y={BP_TOP}    width={IW} height={yVeryHigh - BP_TOP}    fill="#ef444412" />
        <rect x={BP_LEFT} y={yVeryHigh} width={IW} height={yHigh - yVeryHigh}      fill="#f59e0b10" />
        <rect x={BP_LEFT} y={yHigh}     width={IW} height={yLow - yHigh}           fill="#22c55e10" />
        <rect x={BP_LEFT} y={yLow}      width={IW} height={yVeryLow - yLow}        fill="#f9731610" />
        <rect x={BP_LEFT} y={yVeryLow}  width={IW} height={yBottom - yVeryLow}     fill="#dc262612" />

        {/* Threshold dashed lines */}
        <line x1={BP_LEFT} y1={yHigh} x2={BP_LEFT + IW} y2={yHigh} stroke="#f59e0b" strokeWidth={0.8} strokeDasharray="4 2" opacity={0.6} />
        <line x1={BP_LEFT} y1={yLow}  x2={BP_LEFT + IW} y2={yLow}  stroke="#f97316" strokeWidth={0.8} strokeDasharray="4 2" opacity={0.6} />

        {/* Vertical separators at 6h, 12h, 18h */}
        {[6, 12, 18].map(h => (
          <line
            key={h}
            x1={BP_LEFT + h * COL_W} y1={BP_TOP}
            x2={BP_LEFT + h * COL_W} y2={yBottom}
            stroke="hsl(var(--border))" strokeWidth={0.5} strokeDasharray="2 2" opacity={0.5}
          />
        ))}

        {/* Y-axis line */}
        <line
          x1={BP_LEFT} y1={BP_TOP}
          x2={BP_LEFT} y2={yBottom}
          stroke="hsl(var(--border))" strokeWidth={1}
        />

        {/* Y-axis ticks + labels */}
        {Y_TICKS.map(v => (
          <g key={v}>
            <line
              x1={BP_LEFT - 3} y1={yOf(v)}
              x2={BP_LEFT}     y2={yOf(v)}
              stroke="hsl(var(--muted-foreground))" strokeWidth={0.5}
            />
            <text
              x={BP_LEFT - 5} y={yOf(v)}
              textAnchor="end" dominantBaseline="middle"
              fontSize={7.5}
              style={{ fill: 'hsl(var(--muted-foreground))' }}
            >
              {v}
            </text>
          </g>
        ))}

        {/* Box plots */}
        {data.map(h => {
          if (h.count === 0) return null;

          const cx   = BP_LEFT + h.hour * COL_W + COL_W / 2;
          const zone = glucoseZone(h.averageGlucose, thresholds);
          const col  = ZONE_COLOR[zone];

          const yP5  = yOf(h.p5);
          const yP25 = yOf(h.p25);
          const yMed = yOf(h.median);
          const yP75 = yOf(h.p75);
          const yP95 = yOf(h.p95);

          const boxY = Math.min(yP25, yP75);
          const boxH = Math.max(1, Math.abs(yP25 - yP75));

          return (
            <g key={h.hour}>
              {/* Whisker: P5 → P95 */}
              <line x1={cx} y1={yP5} x2={cx} y2={yP95} stroke={col} strokeWidth={1} opacity={0.6} />
              {/* Whisker caps */}
              <line x1={cx - 3} y1={yP5}  x2={cx + 3} y2={yP5}  stroke={col} strokeWidth={1} />
              <line x1={cx - 3} y1={yP95} x2={cx + 3} y2={yP95} stroke={col} strokeWidth={1} />
              {/* Box: P25 → P75 */}
              <rect
                x={cx - BOX_HW} y={boxY}
                width={BOX_HW * 2} height={boxH}
                fill={col + '44'} stroke={col} strokeWidth={1} rx={1.5}
              />
              {/* Median line */}
              <line
                x1={cx - BOX_HW} y1={yMed}
                x2={cx + BOX_HW} y2={yMed}
                stroke={col} strokeWidth={2} strokeLinecap="round"
              />
            </g>
          );
        })}

        {/* X-axis labels */}
        {X_LABELS.map(h => (
          <text
            key={h}
            x={BP_LEFT + h * COL_W + COL_W / 2}
            y={BP_TOP + IH + 14}
            textAnchor="middle" fontSize={7.5}
            style={{ fill: 'hsl(var(--muted-foreground))' }}
          >
            {String(h).padStart(2, '0')}h
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-2 justify-center text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <svg width="18" height="10">
            <line x1="9" y1="0" x2="9" y2="10" stroke="#9ca3af" strokeWidth={1} />
            <line x1="4" y1="0" x2="14" y2="0" stroke="#9ca3af" strokeWidth={1} />
            <line x1="4" y1="10" x2="14" y2="10" stroke="#9ca3af" strokeWidth={1} />
          </svg>
          P5 – P95
        </span>
        <span className="flex items-center gap-1">
          <svg width="18" height="10">
            <rect x="3" y="0" width="12" height="10" fill="#22c55e44" stroke="#22c55e" strokeWidth={1} rx={1} />
          </svg>
          P25 – P75
        </span>
        <span className="flex items-center gap-1">
          <svg width="18" height="4">
            <line x1="0" y1="2" x2="18" y2="2" stroke="#22c55e" strokeWidth={2} />
          </svg>
          Mediana
        </span>
      </div>
    </div>
  );
}
