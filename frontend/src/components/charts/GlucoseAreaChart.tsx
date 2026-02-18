// ============================================================================
// GlucoseAreaChart - Interactive glucose readings over time
// Colors follow TIR zones: veryHigh=red, high=amber, inRange=green,
// low=orange, veryLow=red. Gradient offsets are computed dynamically
// from the actual Y-axis range so zone boundaries are pixel-accurate.
// Supports drag-to-zoom: drag horizontally to select a time range.
// Double-click or "Reset" button restores the full view.
//
// AR2 prediction: extends the chart 30 min ahead using the same algorithm
// as Nightscout (sgv_next = 1.6*s0 - 0.6*s1). Shown as a dashed line with
// the same TIR zone colors at lower opacity.
//
// Treatment markers: Colored circles with letter codes overlaid at the
// bottom of the chart for each treatment in the visible period.
// Hover shows a detailed tooltip. Only visible for periods ≤ 24h.
// ============================================================================

import { useState, useEffect } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  Scatter,
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
import { getTreatments } from '../../lib/api';
import type { GlucoseEntry, Treatment } from '../../lib/api';
import { useDashboardStore, getPeriodDates, type Period, type AlarmThresholds } from '../../stores/dashboardStore';
import { getTrendArrow } from '../../lib/utils';
import { formatGlucose, unitLabel } from '../../lib/glucose';
import type { GlucoseUnit } from '../../lib/glucose';

interface Props {
  entries: GlucoseEntry[];
  loading: boolean;
}

interface ChartPoint {
  time: number;
  sgv?: number | null;
  sgvPredicted?: number | null;
  direction?: string;
  trend?: number;
}

// ── Treatment visual config ─────────────────────────────────────────────────

const TREATMENT_VISUAL: Record<string, { color: string; label: string; char: string }> = {
  'Meal Bolus':       { color: '#3b82f6', label: 'Refeição + Bolus',   char: 'R' },
  'Correction Bolus': { color: '#8b5cf6', label: 'Bolus de Correção',  char: 'B' },
  'Carb Correction':  { color: '#f97316', label: 'Correção de Carbos', char: 'C' },
  'BG Check':         { color: '#14b8a6', label: 'Leitura de Glicose', char: 'G' },
  'Note':             { color: '#64748b', label: 'Anotação',            char: 'N' },
};

// TIR zone colors (matching TIRChart)
const ZONE = {
  veryHigh: '#dc2626',
  high:     '#f59e0b',
  inRange:  '#22c55e',
  low:      '#f97316',
  veryLow:  '#dc2626',
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
  const thresholds = [t.veryHigh, t.high, t.low, t.veryLow];
  const stops: { offset: string; color: string }[] = [];

  stops.push({ offset: '0%', color: zoneColor(maxVal, t) });
  for (const thresh of thresholds) {
    if (thresh < maxVal && thresh > minVal) {
      const off = toOffset(thresh, minVal, maxVal);
      stops.push({ offset: off, color: zoneColor(thresh + 1, t) });
      stops.push({ offset: off, color: zoneColor(thresh - 1, t) });
    }
  }
  stops.push({ offset: '100%', color: zoneColor(minVal, t) });
  return stops;
}

// ── AR2 prediction algorithm ─────────────────────────────────────────────────

function calculateAR2(
  entries: GlucoseEntry[],
  steps = 6
): Array<{ time: number; sgvPredicted: number }> {
  if (entries.length < 2) return [];
  const sorted = [...entries].sort((a, b) => b.date - a.date);
  const last = sorted[0];
  const prev = sorted[1];
  if (Date.now() - last.date > 10 * 60_000) return [];
  const interval = Math.max(3 * 60_000, Math.min(10 * 60_000, last.date - prev.date));
  const predictions: Array<{ time: number; sgvPredicted: number }> = [];
  let s0 = last.sgv, s1 = prev.sgv;
  for (let i = 1; i <= steps; i++) {
    const p = Math.max(40, Math.min(400, 1.6 * s0 - 0.6 * s1));
    predictions.push({ time: last.date + i * interval, sgvPredicted: p });
    s1 = s0; s0 = p;
  }
  return predictions;
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

// X-axis tick config when zoomed
function getZoomedTickConfig(domainMs: number): { intervalMs: number; formatStr: string } {
  if (domainMs <= 2 * 3600_000)   return { intervalMs: 5 * 60_000,    formatStr: 'HH:mm' };
  if (domainMs <= 6 * 3600_000)   return { intervalMs: 15 * 60_000,   formatStr: 'HH:mm' };
  if (domainMs <= 12 * 3600_000)  return { intervalMs: 30 * 60_000,   formatStr: 'HH:mm' };
  if (domainMs <= 24 * 3600_000)  return { intervalMs: 60 * 60_000,   formatStr: 'HH:mm' };
  return { intervalMs: 24 * 3600_000, formatStr: 'dd/MM' };
}

// ── Treatment tooltip (HTML overlay) ─────────────────────────────────────────

function TreatmentTooltipContent({ treatment, unit }: { treatment: Treatment; unit: GlucoseUnit }) {
  const ul = unitLabel(unit);
  const cfg = TREATMENT_VISUAL[treatment.eventType];
  const labelPT = cfg?.label ?? treatment.eventType;
  const timeStr = format(new Date(treatment.created_at), "dd/MM 'às' HH:mm", { locale: ptBR });

  return (
    <div>
      <p className="font-semibold text-xs mb-0.5" style={{ color: cfg?.color }}>{labelPT}</p>
      <p className="text-[10px] text-muted-foreground mb-1.5">{timeStr}</p>
      <div className="space-y-0.5 text-xs">
        {treatment.insulin  != null && <p>Insulina: <span className="font-medium">{treatment.insulin}U</span></p>}
        {treatment.carbs    != null && <p>Carbos: <span className="font-medium">{treatment.carbs}g</span></p>}
        {treatment.glucose  != null && <p>Glicose: <span className="font-medium">{formatGlucose(treatment.glucose, unit)} {ul}</span></p>}
        {treatment.protein  != null && <p>Proteína: <span className="font-medium">{treatment.protein}g</span></p>}
        {treatment.fat      != null && <p>Gordura: <span className="font-medium">{treatment.fat}g</span></p>}
        {treatment.notes              && <p className="text-muted-foreground italic mt-0.5">"{treatment.notes}"</p>}
      </div>
    </div>
  );
}

// ── Custom SVG shape for treatment Scatter points ─────────────────────────────

interface TreatmentShapeProps {
  cx?: number;
  cy?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any;
  onEnter: (treatment: Treatment, cx: number, cy: number) => void;
  onLeave: () => void;
}

function TreatmentShape({ cx = 0, cy = 0, payload, onEnter, onLeave }: TreatmentShapeProps) {
  if (!payload?.isTreatment || !payload.treatment) return null;
  const cfg = TREATMENT_VISUAL[payload.treatment.eventType];
  if (!cfg) return null;

  return (
    <g
      onMouseEnter={() => onEnter(payload.treatment, cx, cy)}
      onMouseLeave={onLeave}
      style={{ cursor: 'pointer' }}
    >
      {/* White ring for contrast against all chart backgrounds */}
      <circle cx={cx} cy={cy} r={9}   fill="white"    opacity={0.75} />
      <circle cx={cx} cy={cy} r={7.5} fill={cfg.color} opacity={0.92} />
      <text
        x={cx} y={cy + 3.5}
        textAnchor="middle"
        fill="white"
        fontSize={8.5}
        fontWeight="bold"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {cfg.char}
      </text>
    </g>
  );
}

// ── Recharts tooltip for glucose points ──────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: Array<{ payload: any }>;
  unit: GlucoseUnit;
  thresholds: AlarmThresholds;
}

function CustomTooltip({ active, payload, unit, thresholds }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  // Treatment markers use their own HTML overlay — suppress Recharts tooltip
  if (point?.isTreatment) return null;

  const isPrediction = point.sgv == null && point.sgvPredicted != null;
  const value = isPrediction ? point.sgvPredicted! : (point.sgv ?? 0);
  const color = zoneColor(value, thresholds);

  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="text-muted-foreground text-xs mb-1">
        {format(new Date(point.time), 'dd/MM HH:mm', { locale: ptBR })}
        {isPrediction && <span className="ml-1 opacity-60">(previsão)</span>}
      </p>
      <p className="font-bold text-base" style={{ color }}>
        {formatGlucose(value, unit)} {unitLabel(unit)}
        {!isPrediction && getTrendArrow(point.trend)}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function GlucoseAreaChart({ entries, loading }: Props) {
  const { period, unit, alarmThresholds, darkMode, lastRefresh } = useDashboardStore();

  // Zoom state
  const [zoomLeft, setZoomLeft]         = useState<number | null>(null);
  const [zoomRight, setZoomRight]       = useState<number | null>(null);
  const [zoomedDomain, setZoomedDomain] = useState<[number, number] | null>(null);
  const isZoomed = zoomedDomain !== null;

  // Treatment markers state
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [treatmentTooltip, setTreatmentTooltip] = useState<{
    treatment: Treatment;
    cx: number;
    cy: number;
  } | null>(null);

  // Show markers only for periods ≤ 24h (for longer periods the chart scale
  // makes markers too dense and visually unreadable)
  const showTreatments = ['1h', '3h', '6h', '12h', '24h'].includes(period);

  useEffect(() => {
    if (!showTreatments) { setTreatments([]); return; }
    let cancelled = false;
    const { startDate, endDate } = getPeriodDates(period as Period);
    getTreatments({ startDate, endDate, limit: 500 })
      .then((data) => { if (!cancelled) setTreatments(data ?? []); })
      .catch(() => { if (!cancelled) setTreatments([]); });
    return () => { cancelled = true; };
  }, [period, lastRefresh, showTreatments]);

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

  // ── AR2 predictions ─────────────────────────────────────────────────────────
  const showPredictions = ['1h', '3h', '6h', '12h', '24h'].includes(period);
  let chartData: ChartPoint[] = data.map((d) => ({ ...d }));

  if (showPredictions && data.length >= 2) {
    const predPoints = calculateAR2(entries);
    if (predPoints.length > 0) {
      chartData[chartData.length - 1] = {
        ...chartData[chartData.length - 1],
        sgvPredicted: chartData[chartData.length - 1].sgv,
      };
      predPoints.forEach((p) =>
        chartData.push({ time: p.time, sgvPredicted: p.sgvPredicted })
      );
    }
  }

  // Filter to zoomed range
  const visibleData = zoomedDomain
    ? chartData.filter((d) => d.time >= zoomedDomain[0] && d.time <= zoomedDomain[1])
    : chartData;
  const displayData = visibleData.length > 0 ? visibleData : chartData;

  // Y axis adapts to visible range
  const allSgv = displayData.flatMap((d) => [d.sgv, d.sgvPredicted]).filter((v): v is number => v != null);
  const rawMin = allSgv.length > 0 ? Math.min(...allSgv) : 70;
  const rawMax = allSgv.length > 0 ? Math.max(...allSgv) : 180;
  const minVal = Math.max(0, rawMin - 20);
  const maxVal = Math.min(400, rawMax + 30);

  // ── Treatment marker points ─────────────────────────────────────────────────
  const displayStart = zoomedDomain ? zoomedDomain[0] : (data[0]?.time ?? 0);
  const displayEnd   = zoomedDomain ? zoomedDomain[1] : (chartData[chartData.length - 1]?.time ?? Date.now());
  const markerY = minVal + (maxVal - minVal) * 0.05; // 5% from bottom edge

  const treatmentPoints = treatments
    .filter((t) => {
      const ts = new Date(t.created_at).getTime();
      return ts >= displayStart && ts <= displayEnd;
    })
    .map((t) => ({
      time:        new Date(t.created_at).getTime(),
      markerY,
      isTreatment: true as const,
      treatment:   t,
    }));

  const visibleEventTypes = [...new Set(treatmentPoints.map((p) => p.treatment.eventType))];

  // Tick config
  const { ticks: baseTicks, formatStr: baseFormatStr } = getTickConfig(
    period, data[0].time, chartData[chartData.length - 1].time
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
    activeTicks    = baseTicks;
    activeFormatStr = baseFormatStr;
  }

  const actualCount = displayData.filter((d) => d.sgv != null).length;
  const showDots = actualCount <= 20;
  const strokeStops = buildStrokeStops(minVal, maxVal, alarmThresholds);

  const refLines: { y: number; color: string; label: string; dash: string }[] = [
    { y: alarmThresholds.veryHigh, color: ZONE.veryHigh, label: String(alarmThresholds.veryHigh), dash: '3 4' },
    { y: alarmThresholds.high,     color: ZONE.high,     label: String(alarmThresholds.high),     dash: '4 4' },
    { y: alarmThresholds.low,      color: ZONE.low,      label: String(alarmThresholds.low),       dash: '4 4' },
    { y: alarmThresholds.veryLow,  color: ZONE.veryLow,  label: String(alarmThresholds.veryLow),  dash: '2 4' },
  ].filter((r) => r.y > minVal && r.y < maxVal);

  // Zoom handlers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMouseDown = (e: any) => {
    if (e?.activeLabel != null) setZoomLeft(Number(e.activeLabel));
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMouseMove = (e: any) => {
    if (zoomLeft !== null && e?.activeLabel != null) setZoomRight(Number(e.activeLabel));
  };
  const handleMouseUp = () => {
    if (zoomLeft !== null && zoomRight !== null) {
      const l = Math.min(zoomLeft, zoomRight);
      const r = Math.max(zoomLeft, zoomRight);
      if (r - l > 60_000) setZoomedDomain([l, r]);
    }
    setZoomLeft(null);
    setZoomRight(null);
  };

  const selectionFill   = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const selectionStroke = darkMode ? 'rgba(255,255,255,0.4)'  : 'rgba(0,0,0,0.3)';

  // Treatment shape renderer — closes over the state setter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const treatmentShape = (props: any) => (
    <TreatmentShape
      {...props}
      onEnter={(t: Treatment, cx: number, cy: number) => setTreatmentTooltip({ treatment: t, cx, cy })}
      onLeave={() => setTreatmentTooltip(null)}
    />
  );

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
        {/* Wrapper with position:relative for the treatment tooltip overlay */}
        <div style={{ position: 'relative', cursor: zoomLeft !== null ? 'ew-resize' : 'crosshair' }}>
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
                <linearGradient id="glStroke" x1="0" y1="0" x2="0" y2="1">
                  {strokeStops.map((s, i) => (
                    <stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={0.95} />
                  ))}
                </linearGradient>
                <linearGradient id="glFill" x1="0" y1="0" x2="0" y2="1">
                  {strokeStops.map((s, i) => {
                    const frac = parseFloat(s.offset) / 100;
                    const op = Math.max(0.02, 0.20 - frac * 0.16);
                    return <stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={op} />;
                  })}
                </linearGradient>
                <linearGradient id="predStroke" x1="0" y1="0" x2="0" y2="1">
                  {strokeStops.map((s, i) => (
                    <stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={0.6} />
                  ))}
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

              {/* Actual glucose readings */}
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
                connectNulls={false}
              />

              {/* AR2 prediction line */}
              {showPredictions && (
                <Line
                  type="monotone"
                  dataKey="sgvPredicted"
                  stroke="url(#predStroke)"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={{ r: 3, strokeWidth: 0, opacity: 0.7 }}
                  activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )}

              {/* Treatment markers — Scatter with custom SVG shapes */}
              {showTreatments && treatmentPoints.length > 0 && (
                <Scatter
                  data={treatmentPoints}
                  dataKey="markerY"
                  shape={treatmentShape}
                  isAnimationActive={false}
                />
              )}

              {/* Selection highlight during drag-to-zoom */}
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

          {/* Treatment tooltip — HTML div absolutely positioned over the SVG */}
          {treatmentTooltip && (
            <div
              style={{
                position: 'absolute',
                left:     Math.min(treatmentTooltip.cx + 14, 250),
                top:      Math.max(treatmentTooltip.cy - 24, 4),
                zIndex:   50,
                pointerEvents: 'none',
              }}
              className="bg-background border border-border rounded-lg shadow-xl p-2.5 text-xs min-w-[150px] max-w-[210px]"
            >
              <TreatmentTooltipContent treatment={treatmentTooltip.treatment} unit={unit} />
            </div>
          )}
        </div>

        {/* Legend — shown only when treatment markers are present in the visible window */}
        {showTreatments && visibleEventTypes.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 pt-2 border-t border-border/50">
            {Object.entries(TREATMENT_VISUAL)
              .filter(([type]) => visibleEventTypes.includes(type))
              .map(([type, { color, char, label }]) => (
                <div key={type} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span
                    className="inline-flex items-center justify-center rounded-full text-white font-bold shrink-0"
                    style={{ backgroundColor: color, width: 15, height: 15, fontSize: 8 }}
                  >
                    {char}
                  </span>
                  {label}
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
