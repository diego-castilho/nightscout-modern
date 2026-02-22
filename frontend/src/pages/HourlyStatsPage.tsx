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
import { glucoseZone, type GlucoseZone } from '../lib/weeklyAggregations';
import { BoxPlotChart } from '../components/charts/BoxPlotChart';

// ============================================================================
// Constants & types
// ============================================================================

const PERIODS = PERIOD_OPTIONS;

type ViewMode = 'boxplot' | 'heatmap';

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
