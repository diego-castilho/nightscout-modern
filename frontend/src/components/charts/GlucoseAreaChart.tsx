// ============================================================================
// GlucoseAreaChart - Interactive glucose readings over time
// Colors follow TIR zones: veryHigh=red, high=amber, inRange=green,
// low=orange, veryLow=red. Gradient offsets are computed dynamically
// from the actual Y-axis range so zone boundaries are pixel-accurate.
// Supports drag-to-zoom: drag horizontally to select a time range.
// Double-click or "Reset" button restores the full view.
// ============================================================================

import { useState } from 'react';
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ZoomOut } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { GlucoseEntry } from '../../lib/api';
import { useDashboardStore, type Period, type AlarmThresholds } from '../../stores/dashboardStore';
import { getTrendArrow } from '../../lib/utils';
import { formatGlucose, unitLabel } from '../../lib/glucose';

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
function zoneColor(val: number, t: AlarmThresholds): string {
  if (val > t.veryHigh) return ZONE.veryHigh;
  if (val > t.high)     return ZONE.high;
  if (val >= t.low)     return ZONE.inRange;
  if (val >= t.veryLow) return ZONE.low;
  return ZONE.veryLow;
}

// Builds gradient stops with exact boundary positions for the stroke
function buildStrokeStops(minVal: number, maxVal: number, t: AlarmThresholds) {
  const thresholds = [t.veryHigh, t.high, t.low, t.veryLow]; // descending
  const stops: { offset: string; color: string }[] = [];

  // Top boundary
  stops.push({ offset: '0%', color: zoneColor(maxVal, t) });

  // Add a stop pair at each threshold that falls within [minVal, maxVal]
  for (const thresh of thresholds) {
    if (thresh < maxVal && thresh > minVal) {
      const off = toOffset(thresh, minVal, maxVal);
      stops.push({ offset: off, color: zoneColor(thresh + 1, t) }); // just above threshold
      stops.push({ offset: off, color: zoneColor(thresh - 1, t) }); // just below threshold
    }
  }

  // Bottom boundary
  stops.push({ offset: '100%', color: zoneColor(minVal, t) });

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

// X-axis tick config when zoomed (based on visible duration)
function getZoomedTickConfig(domainMs: number): { intervalMs: number; formatStr: string } {
  if (domainMs <= 2 * 3600_000)   return { intervalMs: 5 * 60_000,        formatStr: 'HH:mm' };
  if (domainMs <= 6 * 3600_000)   return { intervalMs: 15 * 60_000,       formatStr: 'HH:mm' };
  if (domainMs <= 12 * 3600_000)  return { intervalMs: 30 * 60_000,       formatStr: 'HH:mm' };
  if (domainMs <= 24 * 3600_000)  return { intervalMs: 60 * 60_000,       formatStr: 'HH:mm' };
  return { intervalMs: 24 * 3600_000, formatStr: 'dd/MM' };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}

interface CustomTooltipWithUnitProps extends CustomTooltipProps {
  unit: import('../../lib/glucose').GlucoseUnit;
  thresholds: AlarmThresholds;
}

function CustomTooltip({ active, payload, unit, thresholds }: CustomTooltipWithUnitProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const color = zoneColor(point.sgv, thresholds);
  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="text-muted-foreground text-xs mb-1">
        {format(new Date(point.time), 'dd/MM HH:mm', { locale: ptBR })}
      </p>
      <p className="font-bold text-base" style={{ color }}>
        {formatGlucose(point.sgv, unit)} {unitLabel(unit)} {getTrendArrow(point.trend)}
      </p>
    </div>
  );
}

export function GlucoseAreaChart({ entries, loading }: Props) {
  const { period, unit, alarmThresholds, darkMode } = useDashboardStore();

  // Zoom state
  const [zoomLeft, setZoomLeft]     = useState<number | null>(null);
  const [zoomRight, setZoomRight]   = useState<number | null>(null);
  const [zoomedDomain, setZoomedDomain] = useState<[number, number] | null>(null);
  const isZoomed = zoomedDomain !== null;

  const resetZoom = () => setZoomedDomain(null);

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

  // Filter to zoomed range — this is what actually expands the chart visually
  const visibleData = zoomedDomain
    ? data.filter(d => d.time >= zoomedDomain[0] && d.time <= zoomedDomain[1])
    : data;

  const displayData = visibleData.length > 0 ? visibleData : data;

  // Y axis adapts to the visible range when zoomed
  const rawMin = Math.min(...displayData.map((d) => d.sgv));
  const rawMax = Math.max(...displayData.map((d) => d.sgv));
  const minVal = Math.max(0, rawMin - 20);
  const maxVal = Math.min(400, rawMax + 30);

  // Active ticks/format — adapts when zoomed
  const { ticks: baseTicks, formatStr: baseFormatStr } = getTickConfig(
    period, data[0].time, data[data.length - 1].time
  );

  let activeTicks: number[];
  let activeFormatStr: string;

  if (zoomedDomain) {
    const domainMs = zoomedDomain[1] - zoomedDomain[0];
    const { intervalMs, formatStr: zFs } = getZoomedTickConfig(domainMs);
    const zTicks: number[] = [];
    const firstTick = Math.ceil(zoomedDomain[0] / intervalMs) * intervalMs;
    for (let t = firstTick; t <= zoomedDomain[1]; t += intervalMs) zTicks.push(t);
    activeTicks = zTicks;
    activeFormatStr = zFs;
  } else {
    activeTicks = baseTicks;
    activeFormatStr = baseFormatStr;
  }

  const showDots = displayData.length <= 20;
  const strokeStops = buildStrokeStops(minVal, maxVal, alarmThresholds);

  // Reference lines only if threshold is within the Y range
  const refLines: { y: number; color: string; label: string; dash: string }[] = [
    { y: alarmThresholds.veryHigh, color: ZONE.veryHigh, label: String(alarmThresholds.veryHigh), dash: '3 4' },
    { y: alarmThresholds.high,     color: ZONE.high,     label: String(alarmThresholds.high),     dash: '4 4' },
    { y: alarmThresholds.low,      color: ZONE.low,      label: String(alarmThresholds.low),       dash: '4 4' },
    { y: alarmThresholds.veryLow,  color: ZONE.veryLow,  label: String(alarmThresholds.veryLow),  dash: '2 4' },
  ].filter((r) => r.y > minVal && r.y < maxVal);

  // Zoom event handlers — activeLabel gives the interpolated XAxis numeric value
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMouseDown = (e: any) => {
    if (e?.activeLabel != null) setZoomLeft(Number(e.activeLabel));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMouseMove = (e: any) => {
    if (zoomLeft !== null && e?.activeLabel != null) {
      setZoomRight(Number(e.activeLabel));
    }
  };

  const handleMouseUp = () => {
    if (zoomLeft !== null && zoomRight !== null) {
      const l = Math.min(zoomLeft, zoomRight);
      const r = Math.max(zoomLeft, zoomRight);
      if (r - l > 60_000) setZoomedDomain([l, r]); // minimum 1 minute
    }
    setZoomLeft(null);
    setZoomRight(null);
  };

  const selectionFill = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const selectionStroke = darkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Leituras de Glicose</CardTitle>
          {isZoomed && (
            <button
              onClick={resetZoom}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-md
                         bg-muted hover:bg-muted/80 border border-border
                         text-muted-foreground transition-colors"
            >
              <ZoomOut className="h-3 w-3" />
              Reset zoom
            </button>
          )}
        </div>
        {!isZoomed && (
          <p className="text-xs text-muted-foreground">
            Arraste para ampliar um intervalo · Duplo clique para resetar
          </p>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div style={{ cursor: zoomLeft !== null ? 'ew-resize' : 'crosshair' }}>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart
              data={displayData}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onDoubleClick={resetZoom}
            >
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
                ticks={activeTicks}
                tickFormatter={(ms: number) => format(new Date(ms), activeFormatStr, { locale: ptBR })}
                tick={{ fontSize: 11, fill: 'currentColor' }}
                className="text-muted-foreground"
              />

              <YAxis
                domain={[minVal, maxVal]}
                tick={{ fontSize: 11, fill: 'currentColor' }}
                className="text-muted-foreground"
                width={unit === 'mmol' ? 44 : 40}
                tickFormatter={(v: number) => formatGlucose(v, unit)}
              />

              <Tooltip
                content={<CustomTooltip unit={unit} thresholds={alarmThresholds} />}
                isAnimationActive={false}
              />

              {/* TIR zone reference lines */}
              {refLines.map((r) => (
                <ReferenceLine
                  key={r.y}
                  y={r.y}
                  stroke={r.color}
                  strokeDasharray={r.dash}
                  strokeWidth={1.5}
                  label={{
                    value: `${formatGlucose(r.y, unit)}`,
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

              {/* Selection highlight during drag */}
              {zoomLeft !== null && zoomRight !== null && (
                <ReferenceArea
                  x1={Math.min(zoomLeft, zoomRight)}
                  x2={Math.max(zoomLeft, zoomRight)}
                  fill={selectionFill}
                  stroke={selectionStroke}
                  strokeOpacity={0.5}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
