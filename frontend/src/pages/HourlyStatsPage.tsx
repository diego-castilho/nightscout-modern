// ============================================================================
// HourlyStatsPage — Stats horárias: box plot + heat map + tabela numérica
// Fase 3 do roadmap de relatórios clínicos
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { subDays } from 'date-fns';
import { Clock } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useDashboardStore } from '../stores/dashboardStore';
import { getDailyPatterns } from '../lib/api';
import type { DailyPattern } from '../lib/api';
import { formatGlucose, unitLabel } from '../lib/glucose';
import { PERIOD_OPTIONS } from '../lib/periods';

// ============================================================================
// Constants & types
// ============================================================================

const PERIODS = PERIOD_OPTIONS;

type ViewMode = 'boxplot' | 'heatmap';
type GlucoseZone = 'veryLow' | 'low' | 'inRange' | 'high' | 'veryHigh' | 'noData';

// Fixed Y-axis range (clinical standard)
const Y_MIN = 40;
const Y_MAX = 400;

// ============================================================================
// Zone helpers
// ============================================================================

function glucoseZone(
  avg: number,
  t: { veryLow: number; low: number; high: number; veryHigh: number },
): GlucoseZone {
  if (avg === 0)         return 'noData';
  if (avg < t.veryLow)  return 'veryLow';
  if (avg < t.low)      return 'low';
  if (avg <= t.high)    return 'inRange';
  if (avg <= t.veryHigh) return 'high';
  return 'veryHigh';
}

const ZONE_COLOR: Record<GlucoseZone, string> = {
  inRange:  '#22c55e',
  high:     '#f59e0b',
  veryHigh: '#ef4444',
  low:      '#f97316',
  veryLow:  '#dc2626',
  noData:   '#6b7280',
};

const ZONE_TEXT: Record<GlucoseZone, string> = {
  inRange:  'text-green-700 dark:text-green-400',
  high:     'text-amber-700 dark:text-amber-400',
  veryHigh: 'text-red-700 dark:text-red-400',
  low:      'text-orange-700 dark:text-orange-400',
  veryLow:  'text-red-800 dark:text-red-300',
  noData:   'text-muted-foreground',
};

const ZONE_CELL_BG: Record<GlucoseZone, string> = {
  inRange:  'bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700',
  high:     'bg-amber-100 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700',
  veryHigh: 'bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-700',
  low:      'bg-orange-100 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700',
  veryLow:  'bg-red-200 dark:bg-red-950/40 border-red-400 dark:border-red-600',
  noData:   'bg-muted/20 border-border',
};

// ============================================================================
// Box Plot SVG chart
// ============================================================================

const BP_LEFT  = 42;  // Y-axis space
const BP_TOP   = 8;
const BP_BOT   = 22;  // X-axis labels
const BP_RIGHT = 4;
const COL_W    = 27;  // per hour column (24 * 27 = 648px inner)
const BOX_HW   = 8;   // box half-width
const IH       = 180; // inner chart height
const IW       = 24 * COL_W;
const SVG_W    = BP_LEFT + IW + BP_RIGHT;
const SVG_H    = BP_TOP + IH + BP_BOT;

function yOf(v: number): number {
  return BP_TOP + IH - ((Math.min(Y_MAX, Math.max(Y_MIN, v)) - Y_MIN) / (Y_MAX - Y_MIN)) * IH;
}

const Y_TICKS = [54, 70, 100, 140, 180, 250, 300, 350];
const X_LABELS = [0, 3, 6, 9, 12, 15, 18, 21];

function BoxPlotChart({
  data,
  thresholds,
}: {
  data: DailyPattern[];
  thresholds: { veryLow: number; low: number; high: number; veryHigh: number };
}) {
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
        <rect x={BP_LEFT} y={BP_TOP}      width={IW} height={yVeryHigh - BP_TOP}       fill="#ef444412" />
        <rect x={BP_LEFT} y={yVeryHigh}   width={IW} height={yHigh - yVeryHigh}         fill="#f59e0b10" />
        <rect x={BP_LEFT} y={yHigh}       width={IW} height={yLow - yHigh}              fill="#22c55e10" />
        <rect x={BP_LEFT} y={yLow}        width={IW} height={yVeryLow - yLow}           fill="#f9731610" />
        <rect x={BP_LEFT} y={yVeryLow}    width={IW} height={yBottom - yVeryLow}        fill="#dc262612" />

        {/* Threshold dashed lines */}
        <line x1={BP_LEFT} y1={yHigh}    x2={BP_LEFT + IW} y2={yHigh}    stroke="#f59e0b" strokeWidth={0.8} strokeDasharray="4 2" opacity={0.6} />
        <line x1={BP_LEFT} y1={yLow}     x2={BP_LEFT + IW} y2={yLow}     stroke="#f97316" strokeWidth={0.8} strokeDasharray="4 2" opacity={0.6} />

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
          <svg width="18" height="10"><line x1="9" y1="0" x2="9" y2="10" stroke="#9ca3af" strokeWidth={1}/><line x1="4" y1="0" x2="14" y2="0" stroke="#9ca3af" strokeWidth={1}/><line x1="4" y1="10" x2="14" y2="10" stroke="#9ca3af" strokeWidth={1}/></svg>
          P5 – P95
        </span>
        <span className="flex items-center gap-1">
          <svg width="18" height="10"><rect x="3" y="0" width="12" height="10" fill="#22c55e44" stroke="#22c55e" strokeWidth={1} rx={1}/></svg>
          P25 – P75
        </span>
        <span className="flex items-center gap-1">
          <svg width="18" height="4"><line x1="0" y1="2" x2="18" y2="2" stroke="#22c55e" strokeWidth={2}/></svg>
          Mediana
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Heat Map component
// ============================================================================

function HeatMapChart({
  data,
  thresholds,
  unit,
}: {
  data: DailyPattern[];
  thresholds: { veryLow: number; low: number; high: number; veryHigh: number };
  unit: 'mgdl' | 'mmol';
}) {
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {data.map(h => {
          const zone = glucoseZone(h.averageGlucose, thresholds);
          return (
            <div
              key={h.hour}
              className={`flex flex-col items-center justify-center rounded border min-w-[52px] min-h-[72px] px-1 ${ZONE_CELL_BG[zone]}`}
              title={`${String(h.hour).padStart(2, '0')}h — ${h.count} leituras`}
            >
              <span className="text-[10px] text-muted-foreground font-medium">
                {String(h.hour).padStart(2, '0')}h
              </span>
              <span className={`text-sm font-bold ${ZONE_TEXT[zone]}`}>
                {h.count > 0 ? formatGlucose(h.averageGlucose, unit) : '—'}
              </span>
              <span className="text-[9px] text-muted-foreground">
                {h.count > 0 ? `n=${h.count}` : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// HourlyStatsPage
// ============================================================================

export function HourlyStatsPage() {
  const { unit, alarmThresholds } = useDashboardStore();
  const ul = unitLabel(unit);

  const [periodDays, setPeriodDays] = useState(14);
  const [viewMode,   setViewMode]   = useState<ViewMode>('boxplot');
  const [data,    setData]    = useState<DailyPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const thresholds = {
    veryLow:  alarmThresholds.veryLow  ?? 54,
    low:      alarmThresholds.low      ?? 70,
    high:     alarmThresholds.high     ?? 180,
    veryHigh: alarmThresholds.veryHigh ?? 250,
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const now   = new Date();
      const start = subDays(now, periodDays);
      const patterns = await getDailyPatterns(start.toISOString(), now.toISOString());
      setData(patterns);
    } catch {
      setError('Não foi possível carregar os dados horários.');
    } finally {
      setLoading(false);
    }
  }, [periodDays]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <main className="container mx-auto px-4 py-4 max-w-6xl space-y-4">

      {/* ── Cabeçalho com controles ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle>Stats Horárias</CardTitle>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Seletor de período */}
              <div className="flex items-center gap-1">
                {PERIODS.map(p => (
                  <Button
                    key={p.days}
                    variant={periodDays === p.days ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPeriodDays(p.days)}
                    className="text-xs px-3 h-7"
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              {/* Modo de visualização */}
              <div className="flex items-center gap-1">
                <Button
                  variant={viewMode === 'boxplot' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('boxplot')}
                  className="text-xs px-3 h-7"
                >
                  Box Plot
                </Button>
                <Button
                  variant={viewMode === 'heatmap' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('heatmap')}
                  className="text-xs px-3 h-7"
                >
                  Heat Map
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* ── Gráfico ─────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-4 px-3 sm:px-6">
          {error ? (
            <div className="text-center py-8 text-destructive text-sm">{error}</div>
          ) : loading ? (
            <div className="h-52 animate-pulse bg-muted/30 rounded" />
          ) : viewMode === 'boxplot' ? (
            <BoxPlotChart data={data} thresholds={thresholds} />
          ) : (
            <HeatMapChart data={data} thresholds={thresholds} unit={unit} />
          )}
        </CardContent>
      </Card>

      {/* ── Tabela numérica ─────────────────────────────────────────────── */}
      {!loading && !error && (
        <Card>
          <CardContent className="pt-4 px-2 sm:px-6">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-right">
                    <th className="pb-2 pr-3 font-medium text-muted-foreground text-left whitespace-nowrap">Hora</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground">n</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground whitespace-nowrap">Média ({ul})</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground hidden sm:table-cell">DP</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground">Mín</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground hidden md:table-cell">P25</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground">Mediana</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground hidden md:table-cell">P75</th>
                    <th className="pb-2 font-medium text-muted-foreground">Máx</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(h => {
                    const zone = glucoseZone(h.averageGlucose, thresholds);
                    const noData = h.count === 0;
                    return (
                      <tr
                        key={h.hour}
                        className="border-b border-border/40 hover:bg-muted/20 transition-colors text-right"
                      >
                        <td className="py-1.5 pr-3 font-medium text-left tabular-nums">
                          {String(h.hour).padStart(2, '0')}:00
                        </td>
                        <td className="py-1.5 pr-3 tabular-nums text-muted-foreground">
                          {h.count}
                        </td>
                        <td className={`py-1.5 pr-3 font-semibold tabular-nums ${noData ? 'text-muted-foreground' : ZONE_TEXT[zone]}`}>
                          {noData ? '—' : formatGlucose(h.averageGlucose, unit)}
                        </td>
                        <td className="py-1.5 pr-3 tabular-nums text-muted-foreground hidden sm:table-cell">
                          {noData ? '—' : formatGlucose(h.stdDev, unit)}
                        </td>
                        <td className="py-1.5 pr-3 tabular-nums text-orange-600 dark:text-orange-400">
                          {noData ? '—' : formatGlucose(h.min, unit)}
                        </td>
                        <td className="py-1.5 pr-3 tabular-nums text-muted-foreground hidden md:table-cell">
                          {noData ? '—' : formatGlucose(h.p25, unit)}
                        </td>
                        <td className="py-1.5 pr-3 tabular-nums text-muted-foreground">
                          {noData ? '—' : formatGlucose(h.median, unit)}
                        </td>
                        <td className="py-1.5 pr-3 tabular-nums text-muted-foreground hidden md:table-cell">
                          {noData ? '—' : formatGlucose(h.p75, unit)}
                        </td>
                        <td className="py-1.5 tabular-nums text-red-600 dark:text-red-400">
                          {noData ? '—' : formatGlucose(h.max, unit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
