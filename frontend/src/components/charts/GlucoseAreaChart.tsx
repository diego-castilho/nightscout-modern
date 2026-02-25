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

import { useState, useEffect, useRef, memo } from 'react';
import {
  ComposedChart,
  Area,
  Line,
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
import {
  ZoomOut, X, Trash2,
  Utensils, Syringe, Donut, Droplets, NotebookPen,
  Disc, CircleGauge, TestTubeDiagonal, Dumbbell, CakeSlice, Layers,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { getTreatments, deleteTreatment } from '../../lib/api';
import type { GlucoseEntry, Treatment } from '../../lib/api';
import { useDashboardStore, getPeriodDates, type Period, type AlarmThresholds } from '../../stores/dashboardStore';
import { getTrendArrow, timeAgo } from '../../lib/utils';
import { formatGlucose, unitLabel } from '../../lib/glucose';
import type { GlucoseUnit } from '../../lib/glucose';
import { computeBuckets } from '../../lib/glucoseDelta';
import { asyncEffect } from '../../lib/asyncEffect';
import { GLUCOSE_HEX } from '../../lib/glucoseColors';

interface Props {
  entries: GlucoseEntry[];
  loading: boolean;
}

interface ChartPoint {
  time: number;
  sgv?: number | null;
  sgvPredicted?: number | null;
  sgvPredUpper?: number | null;      // actual glucose upper bound (for Y-axis max)
  sgvPredLower?: number | null;      // actual glucose lower bound (Recharts base area)
  sgvPredBandHeight?: number | null; // = upper − lower (Recharts stacked band height)
  direction?: string;
  trend?: number;
}

// ── Treatment visual config ─────────────────────────────────────────────────

const TREATMENT_VISUAL: Record<string, { color: string; label: string; icon: LucideIcon }> = {
  'Meal Bolus':       { color: '#3b82f6', label: 'Refeição + Bolus',   icon: Utensils    },
  'Snack Bolus':      { color: '#ec4899', label: 'Lanche + Bolus',     icon: CakeSlice   },
  'Correction Bolus': { color: '#8b5cf6', label: 'Bolus de Correção',  icon: Syringe     },
  'Combo Bolus':      { color: '#0d9488', label: 'Combo Bolus',        icon: Layers      },
  'Carb Correction':  { color: '#f97316', label: 'Correção de Carbos', icon: Donut       },
  'BG Check':         { color: '#14b8a6', label: 'Leitura de Glicose', icon: Droplets    },
  'Note':             { color: '#64748b', label: 'Anotação',            icon: NotebookPen },
  'Sensor Change':    { color: '#06b6d4', label: 'Troca de Sensor',     icon: Disc        },
  'Site Change':      { color: '#22c55e', label: 'Troca de Site',       icon: CircleGauge      },
  'Insulin Change':   { color: '#f59e0b', label: 'Troca de Insulina',   icon: TestTubeDiagonal },
  'Basal Pen Change': { color: '#818cf8', label: 'Caneta Basal',        icon: Syringe     },
  'Rapid Pen Change': { color: '#fb7185', label: 'Caneta Rápida',       icon: Syringe     },
  'Temp Basal':       { color: '#0ea5e9', label: 'Basal Temporária',    icon: Syringe     },
  'Exercise':         { color: '#10b981', label: 'Exercício',           icon: Dumbbell    },
  'Basal Insulin':    { color: '#6366f1', label: 'Insulina Basal',      icon: Syringe     },
};

// TIR zone colors — sourced from GLUCOSE_HEX (must match index.css vars)
const ZONE = {
  veryHigh: GLUCOSE_HEX.veryHigh,
  high:     GLUCOSE_HEX.high,
  inRange:  GLUCOSE_HEX.inRange,
  low:      GLUCOSE_HEX.low,
  veryLow:  GLUCOSE_HEX.veryLow,
};

// Converts a glucose value to a gradient offset (0% = top, 100% = bottom).
//
// The linearGradient uses gradientUnits="objectBoundingBox" (SVG default).
// The bbox spans [bboxBottom, bboxTop] in glucose units:
//   - Fill path:   bboxBottom = minVal  (baseline), bboxTop = rawMax
//   - Stroke path: bboxBottom = rawMin  (lowest data point), bboxTop = rawMax
// Formula: offset = (bboxTop − val) / (bboxTop − bboxBottom)
function toOffset(val: number, bboxBottom: number, bboxTop: number): string {
  const range = bboxTop - bboxBottom;
  if (range === 0) return '50%';
  const pct = ((bboxTop - val) / range) * 100;
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

// Builds gradient stops for a given bbox range [bboxBottom, bboxTop].
// Fill:   buildGradientStops(minVal, rawMax, t)   — bbox includes the fill baseline
// Stroke: buildGradientStops(rawMin, rawMax, t)   — bbox spans only the data curve
function buildGradientStops(bboxBottom: number, bboxTop: number, t: AlarmThresholds) {
  const thresholds = [t.veryHigh, t.high, t.low, t.veryLow];
  const stops: { offset: string; color: string }[] = [];

  stops.push({ offset: '0%', color: zoneColor(bboxTop, t) });
  for (const thresh of thresholds) {
    if (thresh < bboxTop && thresh > bboxBottom) {
      const off = toOffset(thresh, bboxBottom, bboxTop);
      stops.push({ offset: off, color: zoneColor(thresh + 1, t) });
      stops.push({ offset: off, color: zoneColor(thresh - 1, t) });
    }
  }
  stops.push({ offset: '100%', color: zoneColor(bboxBottom, t) });
  return stops;
}

// ── AR2 prediction algorithm ─────────────────────────────────────────────────
// Mirrors Nightscout ar2.js exactly:
//   - Works in log space: log(sgv / BG_REF)
//   - AR coefficients: curr_new = -0.723*prev + 1.716*curr
//   - Fixed 5-min steps regardless of CGM reading interval (Libre = 1 min)
//   - curr (s0) = bucket mean of readings in [latest-2.5min, latest+2.5min]
//   - prev (s1) = bucket mean of readings in [latest-7.5min, latest-2.5min]
//   - 12 steps × 5 min = 60 min of prediction

const BG_REF = 140;
const BG_MIN = 36;
const BG_MAX = 400;
const AR_COEF = [-0.723, 1.716] as const;
const AR2_STEP_MS = 5 * 60_000;

// Cone-of-uncertainty constants (mirrors Nightscout ar2.js forecastCone)
const CONE_FACTOR = 2;
// Empirical uncertainty growth per 5-min step — 12 steps = 60 min of prediction
const CONE_STEPS = [0.020, 0.041, 0.061, 0.081, 0.099, 0.116, 0.132, 0.146, 0.159, 0.171, 0.182, 0.192] as const;

// Quality thresholds for avgLoss — used by future alarm module
export const AR2_QUALITY_WARN   = 0.05;
export const AR2_QUALITY_URGENT = 0.10;

interface AR2Prediction {
  time: number;
  sgvPredicted: number;
  sgvPredUpper: number;
  sgvPredLower: number;
}

interface AR2Result {
  predictions: AR2Prediction[];
  /** Mean squared log-error of AR2 over last ≤8 readings (model fit quality).
   *  WARN if > AR2_QUALITY_WARN, URGENT if > AR2_QUALITY_URGENT. null if insufficient data. */
  avgLoss: number | null;
}

function calculateAR2(entries: GlucoseEntry[], steps = 12): AR2Result {
  const empty: AR2Result = { predictions: [], avgLoss: null };
  if (entries.length < 2) return empty;

  const sorted = [...entries].sort((a, b) => b.date - a.date);
  const latest = sorted[0];

  if (Date.now() - latest.date > 10 * 60_000) return empty;

  const bucketMean = (arr: GlucoseEntry[]) =>
    arr.reduce((s, e) => s + e.sgv, 0) / arr.length;

  const { recent: recentBucket, prev: prevBucket } = computeBuckets(entries, latest);

  if (!recentBucket.length || !prevBucket.length) return empty;

  const bgnowMean    = bucketMean(recentBucket);
  const mean5MinsAgo = bucketMean(prevBucket);

  if (bgnowMean < BG_MIN || mean5MinsAgo < BG_MIN) return empty;

  // avgLoss: mean squared log-error of AR2 back-tested on last ≤8 valid readings.
  // Measures how well the model fits recent data — high loss → noisy / unreliable.
  let avgLoss: number | null = null;
  {
    const recent = [...entries]
      .filter((e) => e.sgv >= BG_MIN)
      .sort((a, b) => a.date - b.date)
      .slice(-8);
    if (recent.length >= 3) {
      let totalLoss = 0;
      for (let j = 2; j < recent.length; j++) {
        const pLog = Math.log(recent[j - 2].sgv / BG_REF);
        const cLog = Math.log(recent[j - 1].sgv / BG_REF);
        const predictedLog = AR_COEF[0] * pLog + AR_COEF[1] * cLog;
        const actualLog    = Math.log(recent[j].sgv / BG_REF);
        totalLoss += Math.pow(predictedLog - actualLog, 2);
      }
      avgLoss = totalLoss / (recent.length - 2);
    }
  }

  // Initialize in log space (mirrors NS initAR2)
  let prev = Math.log(mean5MinsAgo / BG_REF);
  let curr = Math.log(bgnowMean    / BG_REF);
  let forecastTime = latest.date;

  const predictions: AR2Prediction[] = [];

  for (let i = 0; i < steps; i++) {
    forecastTime += AR2_STEP_MS;
    const nextCurr = AR_COEF[0] * prev + AR_COEF[1] * curr;

    const mgdl  = Math.max(BG_MIN, Math.min(BG_MAX, Math.round(BG_REF * Math.exp(nextCurr))));
    const cStep = CONE_STEPS[i] ?? CONE_STEPS[CONE_STEPS.length - 1];
    const upper = Math.min(BG_MAX, Math.round(BG_REF * Math.exp(nextCurr + CONE_FACTOR * cStep)));
    const lower = Math.max(BG_MIN, Math.round(BG_REF * Math.exp(nextCurr - CONE_FACTOR * cStep)));

    predictions.push({ time: forecastTime, sgvPredicted: mgdl, sgvPredUpper: upper, sgvPredLower: lower });
    prev = curr;
    curr = nextCurr;
  }

  return { predictions, avgLoss };
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
  const createdAtMs = new Date(treatment.created_at).getTime();
  const timeStr = format(new Date(treatment.created_at), "dd/MM 'às' HH:mm", { locale: ptBR });

  return (
    <div>
      <p className="font-semibold text-xs mb-0.5" style={{ color: cfg?.color }}>{labelPT}</p>
      <p className="text-[10px] text-muted-foreground mb-1.5">
        {timeStr} · {timeAgo(createdAtMs)}
      </p>
      <div className="space-y-0.5 text-xs">
        {treatment.exerciseType != null && <p>Tipo: <span className="font-medium capitalize">{treatment.exerciseType}</span></p>}
        {treatment.intensity    != null && <p>Intensidade: <span className="font-medium capitalize">{treatment.intensity}</span></p>}
        {treatment.rate             != null && <p>Taxa: <span className="font-medium">{treatment.rate} {treatment.rateMode === 'relative' ? '%' : 'U/h'}</span></p>}
        {treatment.duration         != null && <p>Duração: <span className="font-medium">{treatment.duration} min</span></p>}
        {treatment.immediateInsulin != null && <p>Imediata: <span className="font-medium">{treatment.immediateInsulin}U</span></p>}
        {treatment.extendedInsulin  != null && <p>Estendida: <span className="font-medium">{treatment.extendedInsulin}U</span></p>}
        {treatment.insulin        != null && treatment.eventType !== 'Combo Bolus' && <p>Insulina: <span className="font-medium">{treatment.insulin}U</span></p>}
        {treatment.carbs          != null && <p>Carbos: <span className="font-medium">{treatment.carbs}g</span></p>}
        {treatment.protein        != null && <p>Proteína: <span className="font-medium">{treatment.protein}g</span></p>}
        {treatment.fat            != null && <p>Gordura: <span className="font-medium">{treatment.fat}g</span></p>}
        {treatment.preBolus != null && treatment.preBolus !== 0 && (
          <p>Carbos: <span className="font-medium">
            {treatment.preBolus < 0 ? `${Math.abs(treatment.preBolus)} min antes` : `${treatment.preBolus} min depois`}
          </span></p>
        )}
        {treatment.glucose        != null && <p>Glicose: <span className="font-medium">{formatGlucose(treatment.glucose, unit)} {ul}</span></p>}
        {treatment.notes              && <p className="text-muted-foreground italic mt-0.5">"{treatment.notes}"</p>}
      </div>
    </div>
  );
}

// ── Custom SVG label for treatment ReferenceLine markers ─────────────────────
// Recharts passes viewBox (SVG pixel coords) to the label element via cloneElement.
// x = pixel position of the reference line; y+height = bottom of the plot area.

interface TreatmentLabelProps {
  viewBox?: { x: number; y: number; width: number; height: number };
  treatment: Treatment;
  isActive: boolean;
  onClick: (treatment: Treatment, cx: number, cy: number) => void;
}

function TreatmentLabel({ viewBox, treatment, isActive, onClick }: TreatmentLabelProps) {
  if (!viewBox) return null;
  const cfg = TREATMENT_VISUAL[treatment.eventType];
  if (!cfg) return null;
  const cx = viewBox.x;
  const cy = viewBox.y + viewBox.height - 12; // 12px above bottom of plot area
  const Icon = cfg.icon;
  const size = 14; // ícone em px

  return (
    <g
      onClick={(e) => { e.stopPropagation(); onClick(treatment, cx, cy); }}
      style={{ cursor: 'pointer' }}
    >
      {/* Halo branco sutil para legibilidade sobre o fundo do gráfico */}
      <circle cx={cx} cy={cy} r={size / 2 + 2} fill="white" opacity={0.55} />
      {/* Anel de destaque quando ativo */}
      {isActive && <circle cx={cx} cy={cy} r={size / 2 + 3} fill="none" stroke={cfg.color} strokeWidth={1.5} opacity={0.7} />}
      <foreignObject x={cx - size / 2} y={cy - size / 2} width={size} height={size} style={{ pointerEvents: 'none', overflow: 'visible' }}>
        <div
          // @ts-expect-error — xmlns required for SVG foreignObject
          xmlns="http://www.w3.org/1999/xhtml"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}
        >
          <Icon size={size} color={cfg.color} strokeWidth={2} />
        </div>
      </foreignObject>
    </g>
  );
}

// ── Recharts tooltip for glucose points ──────────────────────────────────────

interface ChartDataPoint {
  time:           number;
  sgv?:           number;
  sgvPredicted?:  number;
  direction?:     string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartDataPoint }>;
  unit: GlucoseUnit;
  thresholds: AlarmThresholds;
}

function CustomTooltip({ active, payload, unit, thresholds }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

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
        {!isPrediction && getTrendArrow(point.direction)}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

// Returns the fill color for a Temp Basal band based on deviation from scheduled rate
function tempBasalColor(treatment: Treatment, scheduledRate: number): string {
  if (treatment.rate == null || scheduledRate === 0) return '#8b5cf6'; // unknown
  const actualRate = treatment.rateMode === 'relative'
    ? (treatment.rate / 100) * scheduledRate
    : treatment.rate;
  const deviation = actualRate - scheduledRate;
  if (deviation < -0.01) return '#f59e0b'; // reduced / suspend
  if (deviation >  0.01) return '#3b82f6'; // increased
  return '#94a3b8';                        // same as scheduled
}

export const GlucoseAreaChart = memo(function GlucoseAreaChart({ entries, loading }: Props) {
  const { period, unit, alarmThresholds, darkMode, lastRefresh, scheduledBasalRate, predictionsDefault } = useDashboardStore();

  // Zoom state
  const [zoomLeft, setZoomLeft]         = useState<number | null>(null);
  const [zoomRight, setZoomRight]       = useState<number | null>(null);
  const [zoomedDomain, setZoomedDomain] = useState<[number, number] | null>(null);
  const isZoomed = zoomedDomain !== null;

  // Prediction toggle — initialized from user's default preference
  const [predictionsEnabled, setPredictionsEnabled] = useState(predictionsDefault);

  // AR2 quality metric — persisted here for future alarm module consumption
  // Thresholds: AR2_QUALITY_WARN (0.05) and AR2_QUALITY_URGENT (0.10)
  const ar2AvgLossRef = useRef<number | null>(null);

  // Treatment markers state
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [treatmentTooltip, setTreatmentTooltip] = useState<{
    treatment: Treatment;
    cx: number;
    cy: number;
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDeleteTreatment(id: string) {
    setDeletingId(id);
    try {
      await deleteTreatment(id);
      setTreatments((prev) => prev.filter((t) => t._id !== id));
      setTreatmentTooltip(null);
    } catch {
      // silently ignore — user can retry from /treatments page
    } finally {
      setDeletingId(null);
    }
  }

  // Show markers only for periods ≤ 24h (for longer periods the chart scale
  // makes markers too dense and visually unreadable)
  const showTreatments = ['1h', '3h', '6h', '12h', '24h'].includes(period);

  useEffect(() => {
    if (!showTreatments) { setTreatments([]); return; }
    return asyncEffect(async (sig) => {
      const { startDate, endDate } = getPeriodDates(period as Period);
      try {
        const data = await getTreatments({ startDate, endDate, limit: 500 });
        if (!sig.cancelled) setTreatments(data ?? []);
      } catch {
        if (!sig.cancelled) setTreatments([]);
      }
    });
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
  const showPredictions = predictionsEnabled && ['1h', '3h', '6h', '12h', '24h'].includes(period);
  let chartData: ChartPoint[] = data.map((d) => ({ ...d }));

  if (showPredictions && data.length >= 2) {
    const { predictions: predPoints, avgLoss: loss } = calculateAR2(entries);
    ar2AvgLossRef.current = loss;
    if (predPoints.length > 0) {
      // Bridge: mark the last actual reading as the cone origin (zero width)
      // so the prediction line/band connects visually to the glucose curve.
      const lastActual = chartData[chartData.length - 1];
      if (lastActual.sgv != null) {
        chartData[chartData.length - 1] = {
          ...lastActual,
          sgvPredicted:      lastActual.sgv,
          sgvPredUpper:      lastActual.sgv,
          sgvPredLower:      lastActual.sgv,
          sgvPredBandHeight: 0,
        };
      }
      predPoints.forEach((p) =>
        chartData.push({
          time:              p.time,
          sgvPredicted:      p.sgvPredicted,
          sgvPredUpper:      p.sgvPredUpper,
          sgvPredLower:      p.sgvPredLower,
          sgvPredBandHeight: p.sgvPredUpper - p.sgvPredLower,
        })
      );
    }
  }

  // Filter to zoomed range
  const visibleData = zoomedDomain
    ? chartData.filter((d) => d.time >= zoomedDomain[0] && d.time <= zoomedDomain[1])
    : chartData;
  const displayData = visibleData.length > 0 ? visibleData : chartData;

  // Y axis: always starts at 0; max driven by actual + prediction upper bounds
  const actualSgvs = displayData.map((d) => d.sgv).filter((v): v is number => v != null);
  const predMaxSgvs = displayData
    .flatMap((d) => [d.sgvPredicted, d.sgvPredUpper])
    .filter((v): v is number => v != null);
  const rawMin = actualSgvs.length > 0 ? Math.min(...actualSgvs) : 70;
  const allMax = [...actualSgvs, ...predMaxSgvs];
  const rawMax = allMax.length > 0 ? Math.max(...allMax) : 180;
  const minVal = 0;
  const maxVal = Math.min(400, rawMax + 30);

  // ── Treatment marker points ─────────────────────────────────────────────────
  const displayStart = zoomedDomain ? zoomedDomain[0] : (data[0]?.time ?? 0);
  const displayEnd   = zoomedDomain ? zoomedDomain[1] : (chartData[chartData.length - 1]?.time ?? Date.now());

  const visibleTreatments = treatments.filter((t) => {
    const ts = new Date(t.created_at).getTime();
    return ts >= displayStart && ts <= displayEnd;
  });

  // Temp Basal uses ReferenceArea bands; all others use circle markers
  const tempBasalTreatments = visibleTreatments.filter((t) => t.eventType === 'Temp Basal');
  const pointTreatments     = visibleTreatments.filter((t) => t.eventType !== 'Temp Basal');

  const visibleEventTypes = [...new Set(visibleTreatments.map((t) => t.eventType))];

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
  // Fill bbox: [minVal, rawMax]  — fill path includes baseline down to minVal
  // Stroke bbox: [rawMin, rawMax] — stroke path only spans the actual data curve
  const fillStops   = buildGradientStops(minVal,  rawMax, alarmThresholds);
  const strokeStops = buildGradientStops(rawMin, rawMax, alarmThresholds);

  const refLines: { y: number; color: string; label: string; dash: string }[] = [
    { y: alarmThresholds.veryHigh, color: ZONE.veryHigh, label: String(alarmThresholds.veryHigh), dash: '3 4' },
    { y: alarmThresholds.high,     color: ZONE.high,     label: String(alarmThresholds.high),     dash: '4 4' },
    { y: alarmThresholds.low,      color: ZONE.low,      label: String(alarmThresholds.low),       dash: '4 4' },
    { y: alarmThresholds.veryLow,  color: ZONE.veryLow,  label: String(alarmThresholds.veryLow),  dash: '2 4' },
  ].filter((r) => r.y > minVal && r.y < maxVal);

  // Zoom handlers
  const handleMouseDown = (e: { activeLabel?: string | number | null }) => {
    if (e?.activeLabel != null) setZoomLeft(Number(e.activeLabel));
  };
  const handleMouseMove = (e: { activeLabel?: string | number | null }) => {
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
        <div
          style={{ position: 'relative', cursor: zoomLeft !== null ? 'ew-resize' : 'crosshair' }}
          onClick={() => setTreatmentTooltip(null)}
        >
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
                  {fillStops.map((s, i) => {
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

              {/* Actual glucose readings */}
              <Area
                type="monotone"
                dataKey="sgv"
                stroke="url(#glStroke)"
                strokeWidth={2}
                fill="url(#glFill)"
                dot={showDots ? { r: 2.5, strokeWidth: 0 } : false}
                activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
                isAnimationActive={false}
                connectNulls={false}
              />

              {/* AR2 prediction cone — stacked areas: transparent base + cyan band + dashed center */}
              {showPredictions && (
                <>
                  {/* Layer 1 (base): fills from 0 to sgvPredLower — transparent so it
                      acts as a spacer for Recharts stacking. */}
                  <Area
                    type="monotone"
                    dataKey="sgvPredLower"
                    stackId="ar2cone"
                    stroke="none"
                    fill="transparent"
                    connectNulls={false}
                    isAnimationActive={false}
                    dot={false}
                    activeDot={false}
                    legendType="none"
                  />
                  {/* Layer 2 (band): fills from sgvPredLower to sgvPredUpper in cyan */}
                  <Area
                    type="monotone"
                    dataKey="sgvPredBandHeight"
                    stackId="ar2cone"
                    stroke="none"
                    fill="#06b6d4"
                    fillOpacity={0.15}
                    connectNulls={false}
                    isAnimationActive={false}
                    dot={false}
                    activeDot={false}
                    legendType="none"
                  />
                  {/* Center line: dashed cyan prediction */}
                  <Line
                    type="monotone"
                    dataKey="sgvPredicted"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    strokeOpacity={0.75}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={{ r: 5, fill: 'none', stroke: '#06b6d4', strokeWidth: 2 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </>
              )}

              {/* Temp Basal bands — ReferenceArea per treatment, color by deviation */}
              {showTreatments && tempBasalTreatments.map((t) => {
                const startMs = new Date(t.created_at).getTime();
                const endMs   = startMs + (t.duration ?? 0) * 60_000;
                return (
                  <ReferenceArea
                    key={t._id}
                    x1={startMs}
                    x2={endMs}
                    fill={tempBasalColor(t, scheduledBasalRate)}
                    fillOpacity={0.18}
                    strokeOpacity={0}
                  />
                );
              })}

              {/* Treatment markers — one ReferenceLine per treatment (stroke="none"
                  so it doesn't affect tooltip or XAxis domain). Recharts passes
                  viewBox to the label element via cloneElement, giving exact
                  SVG pixel coords for the marker icon placement. */}
              {showTreatments && pointTreatments.map((t) => (
                <ReferenceLine
                  key={t._id}
                  x={new Date(t.created_at).getTime()}
                  stroke="none"
                  label={<TreatmentLabel
                    treatment={t}
                    isActive={treatmentTooltip?.treatment._id === t._id}
                    onClick={(tr, cx, cy) =>
                      setTreatmentTooltip((prev) =>
                        prev?.treatment._id === tr._id ? null : { treatment: tr, cx, cy }
                      )
                    }
                  />}
                />
              ))}

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

          {/* Treatment tooltip — HTML div absolutely positioned below the marker icon.
              Centered horizontally on cx; offset cy by circle radius (9) + gap (6). */}
          {treatmentTooltip && (
            <div
              style={{
                position:  'absolute',
                left:      Math.max(4, treatmentTooltip.cx - 75),
                top:       treatmentTooltip.cy + 15,
                zIndex:    50,
              }}
              className="bg-background border border-border rounded-lg shadow-xl p-2.5 text-xs min-w-[150px] max-w-[200px]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header com botão fechar */}
              <div className="flex items-start justify-between gap-2 mb-1">
                <TreatmentTooltipContent treatment={treatmentTooltip.treatment} unit={unit} />
                <button
                  onClick={() => setTreatmentTooltip(null)}
                  className="shrink-0 text-muted-foreground hover:text-foreground mt-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              {/* Botão deletar */}
              <button
                onClick={() => handleDeleteTreatment(treatmentTooltip.treatment._id)}
                disabled={deletingId === treatmentTooltip.treatment._id}
                className="mt-2 w-full flex items-center justify-center gap-1 rounded border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors py-1 text-[10px] font-medium disabled:opacity-50"
              >
                <Trash2 className="h-2.5 w-2.5" />
                {deletingId === treatmentTooltip.treatment._id ? 'Removendo…' : 'Remover'}
              </button>
            </div>
          )}
        </div>

        {/* Legend + prediction toggle — shown for periods ≤ 24h */}
        {showTreatments && (
          <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border/50">
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {visibleTreatments.length > 0 && Object.entries(TREATMENT_VISUAL)
                .filter(([type]) => visibleEventTypes.includes(type))
                .map(([type, { color, label, icon: Icon }]) => (
                  <div key={type} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Icon size={11} color={color} strokeWidth={2} className="shrink-0" />
                    {label}
                  </div>
                ))}
            </div>
            <button
              onClick={() => setPredictionsEnabled((v) => !v)}
              className={`shrink-0 text-[10px] px-2 py-0.5 rounded border transition-colors select-none ${
                predictionsEnabled
                  ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-600 dark:text-cyan-400'
                  : 'bg-muted/80 border-border text-muted-foreground'
              }`}
            >
              Preditivo
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
