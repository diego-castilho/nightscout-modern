// ============================================================================
// DailyPatternChart - AGP-style 24h pattern with percentile bands
// Always shows the full 24h pattern regardless of selected period.
// Bands: P5–P95 (outer, light) and P25–P75 (inner, darker)
// Median line: 50th percentile (average)
// ============================================================================

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Label,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { DailyPattern } from '../../lib/api';

interface Props {
  patterns: DailyPattern[];
  loading: boolean;
}

interface ChartPoint {
  hour: string;         // "00:00"
  hourNum: number;
  avg: number;
  // Stacked layers (built from p5 up):
  p5_base: number;           // invisible baseline at p5
  outer_low: number;         // p25 - p5  → outer band (light), below IQR
  inner: number;             // p75 - p25 → inner band (IQR, darker)
  outer_high: number;        // p95 - p75 → outer band (light), above IQR
  // Raw values for tooltip
  p5: number;
  p25: number;
  p75: number;
  p95: number;
  count: number;
}

// Fixed Y axis ticks matching the reference image
const Y_TICKS = [0, 54, 70, 180, 250, 350];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;

  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-xs min-w-[150px]">
      <p className="font-semibold text-sm mb-1.5">{d.hour}</p>
      <div className="space-y-0.5">
        <p><span className="text-muted-foreground">Mediana:</span> <span className="font-bold text-green-600 dark:text-green-400">{d.avg} mg/dL</span></p>
        <p><span className="text-muted-foreground">P25–P75:</span> {d.p25}–{d.p75} mg/dL</p>
        <p><span className="text-muted-foreground">P5–P95:</span> {d.p5}–{d.p95} mg/dL</p>
        <p className="text-muted-foreground">{d.count} leituras</p>
      </div>
    </div>
  );
}

export function DailyPatternChart({ patterns, loading }: Props) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Padrão Diário (AGP)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted animate-pulse rounded-md" />
        </CardContent>
      </Card>
    );
  }

  if (!patterns || patterns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Padrão Diário (AGP)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Sem dados suficientes
          </div>
        </CardContent>
      </Card>
    );
  }

  const data: ChartPoint[] = patterns
    .sort((a, b) => a.hour - b.hour)
    .map((p) => {
      const p5  = p.p5  ?? Math.max(40, p.averageGlucose - Math.round(p.stdDev * 1.645));
      const p25 = p.p25 ?? Math.max(p5, p.averageGlucose - Math.round(p.stdDev * 0.674));
      const p75 = p.p75 ?? Math.min(400, p.averageGlucose + Math.round(p.stdDev * 0.674));
      const p95 = p.p95 ?? Math.min(400, p.averageGlucose + Math.round(p.stdDev * 1.645));

      return {
        hour: `${String(p.hour).padStart(2, '0')}:00`,
        hourNum: p.hour,
        avg: p.averageGlucose,
        // Stacked layers from p5 upward:
        p5_base:    Math.max(0, p5),
        outer_low:  Math.max(0, p25 - p5),
        inner:      Math.max(0, p75 - p25),
        outer_high: Math.max(0, p95 - p75),
        // Raw for tooltip:
        p5, p25, p75, p95,
        count: p.count,
      };
    });

  // X-axis ticks every 3 hours
  const xTicks = data
    .filter((d) => d.hourNum % 3 === 0)
    .map((d) => d.hour);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Padrão Diário (AGP)</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 48, left: -10, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="currentColor"
              className="text-border"
              opacity={0.25}
              vertical={true}
              horizontal={false}
            />

            <XAxis
              dataKey="hour"
              ticks={xTicks}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-muted-foreground"
            />

            <YAxis
              ticks={Y_TICKS}
              domain={[0, 350]}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-muted-foreground"
              width={35}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Target range lines */}
            <ReferenceLine y={180} stroke="#22c55e" strokeWidth={1.5}>
              <Label
                value="180"
                position="right"
                fontSize={10}
                fill="#22c55e"
                offset={4}
              />
            </ReferenceLine>
            <ReferenceLine y={70} stroke="#22c55e" strokeWidth={1.5}>
              <Label
                value="70"
                position="right"
                fontSize={10}
                fill="#22c55e"
                offset={4}
              />
            </ReferenceLine>
            <ReferenceLine y={54} stroke="#f97316" strokeDasharray="3 3" strokeWidth={1}>
              <Label
                value="54"
                position="right"
                fontSize={10}
                fill="#f97316"
                offset={4}
              />
            </ReferenceLine>

            {/* ── Stacked percentile bands (bottom → top) ─────────────── */}
            {/* Layer 1: invisible base from 0 to p5 */}
            <Area
              type="monotone"
              dataKey="p5_base"
              stackId="bands"
              stroke="none"
              fill="transparent"
              isAnimationActive={false}
              legendType="none"
            />
            {/* Layer 2: p5→p25 (outer band low, light green) */}
            <Area
              type="monotone"
              dataKey="outer_low"
              stackId="bands"
              stroke="none"
              fill="rgba(34, 197, 94, 0.15)"
              isAnimationActive={false}
              legendType="none"
            />
            {/* Layer 3: p25→p75 (IQR / inner band, darker green) */}
            <Area
              type="monotone"
              dataKey="inner"
              stackId="bands"
              stroke="none"
              fill="rgba(34, 197, 94, 0.35)"
              isAnimationActive={false}
              legendType="none"
            />
            {/* Layer 4: p75→p95 (outer band high, light green) */}
            <Area
              type="monotone"
              dataKey="outer_high"
              stackId="bands"
              stroke="none"
              fill="rgba(34, 197, 94, 0.15)"
              isAnimationActive={false}
              legendType="none"
            />

            {/* Median line (50th percentile / average) */}
            <Line
              type="monotone"
              dataKey="avg"
              stroke="#16a34a"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: '#16a34a' }}
              isAnimationActive={true}
              animationDuration={600}
              legendType="none"
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex gap-4 mt-1 flex-wrap justify-end">
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-0.5 bg-green-700 dark:bg-green-500" />
            <span className="text-[10px] text-muted-foreground">Mediana (50%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded-sm" style={{ background: 'rgba(34,197,94,0.35)' }} />
            <span className="text-[10px] text-muted-foreground">P25–P75</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded-sm" style={{ background: 'rgba(34,197,94,0.15)' }} />
            <span className="text-[10px] text-muted-foreground">P5–P95</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
