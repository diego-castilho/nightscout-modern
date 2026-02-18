// ============================================================================
// ComparisonChart - Comparação de períodos AGP
// Sobrepõe a mediana horária do período atual (verde) com o período
// anterior equivalente (cinza tracejado) num eixo 00:00→23:00.
// Exibe também uma grade de estatísticas comparativas com deltas.
//
// Modos:
//   fixedPeriod prop → modo autônomo (página de comparações): busca ambos os
//     períodos internamente, sempre expandido, sem botão de colapso.
//   sem fixedPeriod  → modo dashboard: recebe currentAnalytics via prop,
//     busca período anterior ao expandir (comportamento original).
// ============================================================================

import { useState, useEffect } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Label,
} from 'recharts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { getAnalytics } from '../../lib/api';
import type { GlucoseAnalytics } from '../../lib/api';
import { useDashboardStore, getPeriodDates, type Period } from '../../stores/dashboardStore';
import { formatGlucose, unitLabel } from '../../lib/glucose';

// Period labels and previous-period calculation
const PERIOD_MS: Record<string, number> = {
  '24h': 86_400_000,
  '7d':  7  * 86_400_000,
  '14d': 14 * 86_400_000,
  '30d': 30 * 86_400_000,
};

const PERIOD_LABELS: Partial<Record<Period, { current: string; previous: string }>> = {
  '24h': { current: 'Hoje',         previous: 'Ontem' },
  '7d':  { current: 'Últimos 7d',   previous: '7d anteriores' },
  '14d': { current: 'Últimos 14d',  previous: '14d anteriores' },
  '30d': { current: 'Últimos 30d',  previous: '30d anteriores' },
};

function getPrevDates(period: Period): { startDate: string; endDate: string } {
  const ms = PERIOD_MS[period] ?? PERIOD_MS['24h'];
  const now = Date.now();
  return {
    endDate:   new Date(now - ms).toISOString(),
    startDate: new Date(now - ms * 2).toISOString(),
  };
}

interface ComparisonPoint {
  hour: string;
  hourNum: number;
  current: number | null;
  previous: number | null;
}

interface Props {
  fixedPeriod?: '24h' | '7d' | '14d' | '30d'; // modo autônomo (página dedicada)
  currentAnalytics?: GlucoseAnalytics | null;   // modo dashboard (passado pelo pai)
}

// Delta arrow + color helpers
// higher = better → TIR
// lower = better  → GMI, CV, Média
function delta(cur: number, prev: number, higherIsBetter: boolean) {
  const d = cur - prev;
  const threshold = 0.5; // ignore negligible changes
  if (Math.abs(d) < threshold) return { arrow: '→', cls: 'text-muted-foreground' };
  const improved = higherIsBetter ? d > 0 : d < 0;
  return {
    arrow: d > 0 ? '↑' : '↓',
    cls: improved ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400',
  };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ComparisonPoint }>;
  unit: import('../../lib/glucose').GlucoseUnit;
  labels: { current: string; previous: string };
}

function CustomTooltip({ active, payload, unit, labels }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const ul = unitLabel(unit);
  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-xs min-w-[160px]">
      <p className="font-semibold text-sm mb-1.5">{d.hour}</p>
      <div className="space-y-0.5">
        {d.current !== null && (
          <p>
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1.5" />
            <span className="text-muted-foreground">{labels.current}: </span>
            <span className="font-bold text-green-600 dark:text-green-400">
              {formatGlucose(d.current, unit)} {ul}
            </span>
          </p>
        )}
        {d.previous !== null && (
          <p>
            <span className="inline-block w-2 h-2 rounded-full bg-slate-400 mr-1.5" />
            <span className="text-muted-foreground">{labels.previous}: </span>
            <span className="font-medium">{formatGlucose(d.previous, unit)} {ul}</span>
          </p>
        )}
      </div>
    </div>
  );
}

export function ComparisonChart({ fixedPeriod, currentAnalytics }: Props) {
  const { period: storePeriod, lastRefresh, alarmThresholds, unit } = useDashboardStore();

  const period = fixedPeriod ?? storePeriod;
  const isStandalone = !!fixedPeriod;

  const [isExpanded, setIsExpanded] = useState(isStandalone);
  const [prevAnalytics, setPrevAnalytics] = useState<GlucoseAnalytics | null>(null);
  const [loadingPrev, setLoadingPrev] = useState(false);

  // Standalone: fetch current period analytics internally
  const [currentAnalyticsLocal, setCurrentAnalyticsLocal] = useState<GlucoseAnalytics | null>(null);
  const [loadingCurrent, setLoadingCurrent] = useState(false);

  const labels = PERIOD_LABELS[period as Period];

  // Reset data when period changes
  useEffect(() => {
    setPrevAnalytics(null);
    if (isStandalone) setCurrentAnalyticsLocal(null);
  }, [period, isStandalone]);

  // Standalone mode: fetch current period
  useEffect(() => {
    if (!isStandalone) return;
    let cancelled = false;
    setLoadingCurrent(true);
    const { startDate, endDate } = getPeriodDates(period as Period);
    getAnalytics(startDate, endDate, alarmThresholds)
      .then((data) => {
        if (!cancelled) { setCurrentAnalyticsLocal(data ?? null); setLoadingCurrent(false); }
      })
      .catch(() => {
        if (!cancelled) { setCurrentAnalyticsLocal(null); setLoadingCurrent(false); }
      });
    return () => { cancelled = true; };
  }, [isStandalone, period, alarmThresholds, lastRefresh]);

  // Fetch previous period analytics (dashboard: only when expanded; standalone: always)
  useEffect(() => {
    if (!isExpanded) return;
    let cancelled = false;
    setLoadingPrev(true);

    const { startDate, endDate } = getPrevDates(period as Period);
    getAnalytics(startDate, endDate, alarmThresholds)
      .then((data) => {
        if (!cancelled) { setPrevAnalytics(data ?? null); setLoadingPrev(false); }
      })
      .catch(() => {
        if (!cancelled) { setPrevAnalytics(null); setLoadingPrev(false); }
      });

    return () => { cancelled = true; };
  }, [period, lastRefresh, isExpanded, alarmThresholds]);

  if (!labels) return null; // Only for 24h/7d/14d/30d

  const resolvedCurrentAnalytics = isStandalone ? currentAnalyticsLocal : (currentAnalytics ?? null);
  const isLoading = loadingPrev || (isStandalone && loadingCurrent);

  // Build chart data (00:00–23:00 axis)
  const currentPatterns = resolvedCurrentAnalytics?.dailyPatterns ?? [];
  const prevPatterns    = prevAnalytics?.dailyPatterns ?? [];

  const chartData: ComparisonPoint[] = Array.from({ length: 24 }, (_, h) => {
    const cur  = currentPatterns.find((p) => p.hour === h);
    const prev = prevPatterns.find((p) => p.hour === h);
    return {
      hour:     `${String(h).padStart(2, '0')}:00`,
      hourNum:  h,
      current:  cur  ? cur.averageGlucose  : null,
      previous: prev ? prev.averageGlucose : null,
    };
  });

  const xTicks = chartData.filter((d) => d.hourNum % 3 === 0).map((d) => d.hour);
  const yTicks = [0, alarmThresholds.veryLow, alarmThresholds.low, alarmThresholds.high, alarmThresholds.veryHigh, 350];

  // Stats comparison
  const curStats  = resolvedCurrentAnalytics?.stats;
  const prevStats = prevAnalytics?.stats;
  const curTIR    = resolvedCurrentAnalytics?.timeInRange;
  const prevTIR   = prevAnalytics?.timeInRange;
  const ul = unitLabel(unit);

  const statsRows = curStats && prevStats && curTIR && prevTIR ? [
    {
      label: 'Média',
      cur:   `${formatGlucose(curStats.average,  unit)} ${ul}`,
      prev:  `${formatGlucose(prevStats.average, unit)} ${ul}`,
      ...delta(curStats.average, prevStats.average, false),
    },
    {
      label: 'GMI',
      cur:   `${curStats.gmi.toFixed(1)}%`,
      prev:  `${prevStats.gmi.toFixed(1)}%`,
      ...delta(curStats.gmi, prevStats.gmi, false),
    },
    {
      label: 'TIR',
      cur:   `${curTIR.percentInRange.toFixed(0)}%`,
      prev:  `${prevTIR.percentInRange.toFixed(0)}%`,
      ...delta(curTIR.percentInRange, prevTIR.percentInRange, true),
    },
    {
      label: 'CV%',
      cur:   `${curStats.cv.toFixed(0)}%`,
      prev:  `${prevStats.cv.toFixed(0)}%`,
      ...delta(curStats.cv, prevStats.cv, false),
    },
  ] : null;

  return (
    <Card>
      {/* Header — clicável no modo dashboard, estático no modo standalone */}
      <CardHeader
        className={`pb-2 ${!isStandalone ? 'cursor-pointer select-none' : ''}`}
        onClick={!isStandalone ? () => setIsExpanded((v) => !v) : undefined}
      >
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>Comparação de Períodos</span>
            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {labels.current} vs {labels.previous}
            </span>
          </div>
          {!isStandalone && (
            isExpanded
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </CardTitle>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          {isLoading && (
            <div className="h-48 bg-muted animate-pulse rounded-md mb-4" />
          )}

          {!isLoading && (
            <>
              {/* Stats comparison grid */}
              {statsRows ? (
                <div className="mb-4 rounded-lg border border-border overflow-hidden">
                  {/* Column headers */}
                  <div className="grid grid-cols-3 bg-muted/50 text-xs font-semibold">
                    <div className="px-3 py-2 text-muted-foreground" />
                    <div className="px-3 py-2 flex items-center gap-1.5 border-l border-border">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
                      {labels.current}
                    </div>
                    <div className="px-3 py-2 flex items-center gap-1.5 border-l border-border">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-400" />
                      {labels.previous}
                    </div>
                  </div>
                  {/* Data rows */}
                  {statsRows.map((row, i) => (
                    <div
                      key={row.label}
                      className={`grid grid-cols-3 text-xs ${i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                    >
                      <div className="px-3 py-2 text-muted-foreground font-medium">{row.label}</div>
                      <div className="px-3 py-2 border-l border-border font-bold flex items-center gap-1">
                        {row.cur}
                        <span className={`text-[11px] font-bold ${row.cls}`}>{row.arrow}</span>
                      </div>
                      <div className="px-3 py-2 border-l border-border text-muted-foreground">{row.prev}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground mb-4 text-center py-2">
                  Carregando estatísticas…
                </div>
              )}

              {/* Comparison chart */}
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart
                  data={chartData}
                  margin={{ top: 8, right: 48, left: -10, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    className="text-border"
                    opacity={0.25}
                    vertical={false}
                  />

                  <XAxis
                    dataKey="hour"
                    ticks={xTicks}
                    tick={{ fontSize: 11, fill: 'currentColor' }}
                    className="text-muted-foreground"
                  />

                  <YAxis
                    ticks={yTicks}
                    domain={[0, 350]}
                    tick={{ fontSize: 11, fill: 'currentColor' }}
                    className="text-muted-foreground"
                    width={unit === 'mmol' ? 38 : 35}
                    tickFormatter={(v: number) => formatGlucose(v, unit)}
                  />

                  <Tooltip content={<CustomTooltip unit={unit} labels={labels} />} />

                  {/* Reference lines */}
                  <ReferenceLine y={alarmThresholds.high} stroke="#22c55e" strokeWidth={1.5}>
                    <Label value={formatGlucose(alarmThresholds.high, unit)} position="right" fontSize={10} fill="#22c55e" offset={4} />
                  </ReferenceLine>
                  <ReferenceLine y={alarmThresholds.low} stroke="#22c55e" strokeWidth={1.5}>
                    <Label value={formatGlucose(alarmThresholds.low, unit)} position="right" fontSize={10} fill="#22c55e" offset={4} />
                  </ReferenceLine>
                  <ReferenceLine y={alarmThresholds.veryLow} stroke="#f97316" strokeDasharray="3 3" strokeWidth={1}>
                    <Label value={formatGlucose(alarmThresholds.veryLow, unit)} position="right" fontSize={10} fill="#f97316" offset={4} />
                  </ReferenceLine>

                  {/* Previous period — dashed gray */}
                  <Line
                    type="monotone"
                    dataKey="previous"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                    name={labels.previous}
                  />

                  {/* Current period — solid green (on top) */}
                  <Line
                    type="monotone"
                    dataKey="current"
                    stroke="#22c55e"
                    strokeWidth={2.5}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={true}
                    animationDuration={500}
                    name={labels.current}
                  />
                </ComposedChart>
              </ResponsiveContainer>

              {/* Legend */}
              <div className="flex gap-4 mt-1 justify-end">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-0.5 bg-green-500" />
                  <span className="text-[10px] text-muted-foreground">{labels.current}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-0.5 bg-slate-400" style={{ borderTop: '2px dashed #94a3b8', height: 0 }} />
                  <span className="text-[10px] text-muted-foreground">{labels.previous}</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
