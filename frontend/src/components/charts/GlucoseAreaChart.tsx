// ============================================================================
// GlucoseAreaChart - Interactive glucose readings over time
// Colors follow TIR zones: veryHigh=red, high=amber, inRange=green,
// low=orange, veryLow=red. Gradient offsets are computed dynamically
// from the actual Y-axis range so zone boundaries are pixel-accurate.
// ============================================================================

import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { GlucoseEntry } from '../../lib/api';
import { useDashboardStore, type Period } from '../../stores/dashboardStore';
import { getTrendArrow } from '../../lib/utils';

interface Props {
  entries: GlucoseEntry[];
  loading: boolean;
}

interface ChartPoint {
  time: number;
  sgv: number;
  direction?: string;
  trend?: number;
}

// TIR zone colors (matching TIRChart)
const ZONE = {
  veryHigh: '#dc2626',  // >250 mg/dL
  high:     '#f59e0b',  // 180–250 mg/dL
  inRange:  '#22c55e',  // 70–180 mg/dL
  low:      '#f97316',  // 54–70 mg/dL
  veryLow:  '#dc2626',  // <54 mg/dL
};

// Converts a glucose value to a gradient offset (0% = top, 100% = bottom)
function toOffset(val: number, minVal: number, maxVal: number): string {
  const range = maxVal - minVal;
  if (range === 0) return '50%';
  const pct = ((maxVal - val) / range) * 100;
  return `${Math.max(0, Math.min(100, pct)).toFixed(2)}%`;
}

// Determines the zone color at a given glucose value
function zoneColor(val: number): string {
  if (val > 250) return ZONE.veryHigh;
  if (val > 180) return ZONE.high;
  if (val >= 70) return ZONE.inRange;
  if (val >= 54) return ZONE.low;
  return ZONE.veryLow;
}

// Builds gradient stops with exact boundary positions for the stroke
function buildStrokeStops(minVal: number, maxVal: number) {
  const thresholds = [250, 180, 70, 54];
  const stops: { offset: string; color: string }[] = [];

  // Top boundary
  stops.push({ offset: '0%', color: zoneColor(maxVal) });

  // Add a stop pair at each threshold that falls within [minVal, maxVal]
  for (const t of thresholds) {
    if (t < maxVal && t > minVal) {
      const off = toOffset(t, minVal, maxVal);
      stops.push({ offset: off, color: zoneColor(t + 1) }); // just above threshold
      stops.push({ offset: off, color: zoneColor(t - 1) }); // just below threshold
    }
  }

  // Bottom boundary
  stops.push({ offset: '100%', color: zoneColor(minVal) });

  return stops;
}

// X-axis tick config per period
function getTickConfig(period: Period, start: number, end: number) {
  const configs: Record<Period, { intervalMs: number; formatStr: string }> = {
    '1h':  { intervalMs: 5 * 60 * 1000,            formatStr: 'HH:mm' },
    '3h':  { intervalMs: 15 * 60 * 1000,           formatStr: 'HH:mm' },
    '6h':  { intervalMs: 30 * 60 * 1000,           formatStr: 'HH:mm' },
    '12h': { intervalMs: 60 * 60 * 1000,           formatStr: 'HH:mm' },
    '24h': { intervalMs: 2 * 60 * 60 * 1000,       formatStr: 'HH:mm' },
    '7d':  { intervalMs: 24 * 60 * 60 * 1000,      formatStr: 'EEE dd/MM' },
    '14d': { intervalMs: 2 * 24 * 60 * 60 * 1000,  formatStr: 'dd/MM' },
    '30d': { intervalMs: 5 * 24 * 60 * 60 * 1000,  formatStr: 'dd/MM' },
  };
  const { intervalMs, formatStr } = configs[period] ?? configs['24h'];
  const ticks: number[] = [];
  const firstTick = Math.ceil(start / intervalMs) * intervalMs;
  for (let t = firstTick; t <= end; t += intervalMs) ticks.push(t);
  return { ticks, formatStr };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const color = zoneColor(point.sgv);
  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="text-muted-foreground text-xs mb-1">
        {format(new Date(point.time), 'dd/MM HH:mm', { locale: ptBR })}
      </p>
      <p className="font-bold text-base" style={{ color }}>
        {point.sgv} mg/dL {getTrendArrow(point.trend)}
      </p>
    </div>
  );
}

export function GlucoseAreaChart({ entries, loading }: Props) {
  const { period } = useDashboardStore();

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Leituras de Glicose</CardTitle></CardHeader>
        <CardContent><div className="h-64 bg-muted animate-pulse rounded-md" /></CardContent>
      </Card>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Leituras de Glicose</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Sem dados para o período selecionado
          </div>
        </CardContent>
      </Card>
    );
  }

  const data: ChartPoint[] = [...entries]
    .sort((a, b) => a.date - b.date)
    .map((e) => ({ time: e.date, sgv: e.sgv, direction: e.direction, trend: e.trend }));

  const rawMin = Math.min(...data.map((d) => d.sgv));
  const rawMax = Math.max(...data.map((d) => d.sgv));
  const minVal = Math.max(0, rawMin - 20);
  const maxVal = Math.min(400, rawMax + 30);

  const { ticks, formatStr } = getTickConfig(period, data[0].time, data[data.length - 1].time);
  const showDots = data.length <= 20;

  const strokeStops = buildStrokeStops(minVal, maxVal);

  // Reference lines only if threshold is within the Y range
  const refLines: { y: number; color: string; label: string; dash: string }[] = [
    { y: 250, color: ZONE.veryHigh, label: '250', dash: '3 4' },
    { y: 180, color: ZONE.high,     label: '180', dash: '4 4' },
    { y: 70,  color: ZONE.low,      label: '70',  dash: '4 4' },
    { y: 54,  color: ZONE.veryLow,  label: '54',  dash: '2 4' },
  ].filter((r) => r.y > minVal && r.y < maxVal);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Leituras de Glicose</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              {/* Stroke gradient — color changes at exact TIR zone boundaries */}
              <linearGradient id="glStroke" x1="0" y1="0" x2="0" y2="1">
                {strokeStops.map((s, i) => (
                  <stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={0.95} />
                ))}
              </linearGradient>

              {/* Fill gradient — same zones, very light opacity */}
              <linearGradient id="glFill" x1="0" y1="0" x2="0" y2="1">
                {strokeStops.map((s, i) => {
                  // Lighter at bottom for depth effect
                  const frac = parseFloat(s.offset) / 100;
                  const op = Math.max(0.02, 0.20 - frac * 0.16);
                  return <stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={op} />;
                })}
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="currentColor"
              className="text-border"
              opacity={0.3}
            />

            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              ticks={ticks}
              tickFormatter={(ms: number) => format(new Date(ms), formatStr, { locale: ptBR })}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-muted-foreground"
            />

            <YAxis
              domain={[minVal, maxVal]}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-muted-foreground"
              width={40}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* TIR zone reference lines */}
            {refLines.map((r) => (
              <ReferenceLine
                key={r.y}
                y={r.y}
                stroke={r.color}
                strokeDasharray={r.dash}
                strokeWidth={1.5}
                label={{
                  value: r.label,
                  position: r.y >= 180 ? 'insideTopRight' : 'insideBottomRight',
                  fontSize: 10,
                  fill: r.color,
                }}
              />
            ))}

            <Area
              type="monotone"
              dataKey="sgv"
              stroke="url(#glStroke)"
              strokeWidth={2}
              fill="url(#glFill)"
              dot={showDots ? { r: 2.5, strokeWidth: 0 } : false}
              activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
              isAnimationActive={true}
              animationDuration={600}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
