// ============================================================================
// WeeklyPage — Resumo semanal: tabela de 7 dias com sparklines + totais
// Fase 2 do roadmap de relatórios clínicos
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  format, startOfISOWeek, addDays, subWeeks, addWeeks,
  startOfDay, endOfDay, isSameWeek, parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarRange } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useDashboardStore } from '../stores/dashboardStore';
import { getGlucoseRange, getTreatments } from '../lib/api';
import type { GlucoseEntry, Treatment } from '../lib/api';
import { formatGlucose, unitLabel } from '../lib/glucose';

// ============================================================================
// Types
// ============================================================================

type GlucoseZone = 'veryLow' | 'low' | 'inRange' | 'high' | 'veryHigh' | 'noData';

interface WeeklyDaySummary {
  date: string;
  weekday: string;
  isFutureDay: boolean;
  hasGlucoseData: boolean;
  avgGlucose: number;
  minGlucose: number;
  maxGlucose: number;
  zone: GlucoseZone;
  tirPercent: number;
  hypoCount: number;
  sparkline: { t: number; v: number }[];
  totalCarbs: number;
  totalRapidInsulin: number;
  totalSlowInsulin: number;
  hasTreatmentData: boolean;
}

interface WeekTotals {
  avgGlucose: number | null;
  tirPercent: number | null;
  hypoCount: number;
  totalCarbs: number;
  totalRapidInsulin: number;
  totalSlowInsulin: number;
}

// ============================================================================
// Constants & helpers
// ============================================================================

const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const RAPID_BOLUS_TYPES = ['Meal Bolus', 'Snack Bolus', 'Correction Bolus'];
const SLOW_BOLUS_TYPES  = ['Basal Insulin'];

function glucoseZone(
  avg: number,
  t: { veryLow: number; low: number; high: number; veryHigh: number },
): GlucoseZone {
  if (avg < t.veryLow)   return 'veryLow';
  if (avg < t.low)       return 'low';
  if (avg <= t.high)     return 'inRange';
  if (avg <= t.veryHigh) return 'high';
  return 'veryHigh';
}

const ZONE_AVG_TEXT: Record<GlucoseZone, string> = {
  inRange:  'text-green-700 dark:text-green-400',
  high:     'text-amber-700 dark:text-amber-400',
  veryHigh: 'text-red-700 dark:text-red-400',
  low:      'text-orange-700 dark:text-orange-400',
  veryLow:  'text-red-800 dark:text-red-300',
  noData:   'text-muted-foreground',
};

const ZONE_STROKE: Record<GlucoseZone, string> = {
  inRange:  '#22c55e',
  high:     '#f59e0b',
  veryHigh: '#ef4444',
  low:      '#f97316',
  veryLow:  '#dc2626',
  noData:   '#9ca3af',
};

function tirColor(pct: number): string {
  if (pct >= 70) return 'text-green-600 dark:text-green-400';
  if (pct >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function formatWeekRange(start: Date, end: Date): string {
  if (
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear()
  ) {
    return `${format(start, 'd', { locale: ptBR })}–${format(end, 'd MMM yyyy', { locale: ptBR })}`;
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${format(start, 'd MMM', { locale: ptBR })}–${format(end, 'd MMM yyyy', { locale: ptBR })}`;
  }
  return `${format(start, 'd MMM yyyy', { locale: ptBR })}–${format(end, 'd MMM yyyy', { locale: ptBR })}`;
}

function fmtNum(val: number, suffix: string): string {
  if (val <= 0) return '—';
  return `${Number.isInteger(val) ? val.toString() : val.toFixed(1)}${suffix}`;
}

// ============================================================================
// Sparkline — SVG inline (sem overhead de Recharts)
// ============================================================================

function Sparkline({
  data,
  low,
  high,
  zone,
}: {
  data: { t: number; v: number }[];
  low: number;
  high: number;
  zone: GlucoseZone;
}) {
  if (data.length < 2) return <span className="text-muted-foreground text-xs">—</span>;

  const W = 130;
  const H = 38;
  const MIN_V = 40;
  const MAX_V = 400;

  const minT   = data[0].t;
  const maxT   = data[data.length - 1].t;
  const rangeT = maxT - minT || 1;

  const xOf = (t: number) => ((t - minT) / rangeT) * W;
  const yOf = (v: number) =>
    H - ((Math.max(MIN_V, Math.min(MAX_V, v)) - MIN_V) / (MAX_V - MIN_V)) * H;

  const points = data
    .map(d => `${xOf(d.t).toFixed(1)},${yOf(d.v).toFixed(1)}`)
    .join(' ');

  const lowY  = yOf(low).toFixed(1);
  const highY = yOf(high).toFixed(1);
  const stroke = ZONE_STROKE[zone];

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <line x1={0} y1={highY} x2={W} y2={highY} stroke="#f59e0b" strokeWidth={0.5} strokeDasharray="2 2" />
      <line x1={0} y1={lowY}  x2={W} y2={lowY}  stroke="#f97316" strokeWidth={0.5} strokeDasharray="2 2" />
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ============================================================================
// Data aggregation (frontend — sem chamada extra ao backend)
// ============================================================================

function aggregateWeek(
  entries: GlucoseEntry[],
  treatments: Treatment[],
  weekStart: Date,
  thresholds: { veryLow: number; low: number; high: number; veryHigh: number },
): WeeklyDaySummary[] {
  return Array.from({ length: 7 }, (_, i) => {
    const dayStart = startOfDay(addDays(weekStart, i));
    const dayEnd   = endOfDay(dayStart);
    const dateStr  = format(dayStart, 'yyyy-MM-dd');
    const weekday  = WEEKDAYS_SHORT[dayStart.getDay()];
    const dayIsFuture = dayStart > new Date();

    const dayEntries = entries
      .filter(e => e.date >= dayStart.getTime() && e.date <= dayEnd.getTime())
      .sort((a, b) => a.date - b.date);

    const dayTreatments = treatments.filter(t => {
      const tTime = new Date(t.created_at).getTime();
      return tTime >= dayStart.getTime() && tTime <= dayEnd.getTime();
    });

    let totalCarbs = 0;
    let totalRapidInsulin = 0;
    let totalSlowInsulin  = 0;
    for (const t of dayTreatments) {
      if (t.carbs) totalCarbs += t.carbs;
      if (RAPID_BOLUS_TYPES.includes(t.eventType)) {
        totalRapidInsulin += t.insulin ?? 0;
      } else if (t.eventType === 'Combo Bolus') {
        totalRapidInsulin += (t.immediateInsulin ?? 0) + (t.extendedInsulin ?? 0);
      } else if (SLOW_BOLUS_TYPES.includes(t.eventType)) {
        totalSlowInsulin += t.insulin ?? 0;
      }
    }

    const round1 = (n: number) => Math.round(n * 10) / 10;

    if (dayEntries.length === 0) {
      return {
        date: dateStr,
        weekday,
        isFutureDay: dayIsFuture,
        hasGlucoseData: false,
        avgGlucose: 0,
        minGlucose: 0,
        maxGlucose: 0,
        zone: 'noData' as GlucoseZone,
        tirPercent: 0,
        hypoCount: 0,
        sparkline: [],
        totalCarbs: round1(totalCarbs),
        totalRapidInsulin: round1(totalRapidInsulin),
        totalSlowInsulin: round1(totalSlowInsulin),
        hasTreatmentData: dayTreatments.length > 0,
      };
    }

    const sgvs         = dayEntries.map(e => e.sgv);
    const avg          = Math.round(sgvs.reduce((a, b) => a + b, 0) / sgvs.length);
    const min          = Math.min(...sgvs);
    const max          = Math.max(...sgvs);
    const inRangeCount = dayEntries.filter(e => e.sgv >= thresholds.low && e.sgv <= thresholds.high).length;
    const tirPercent   = Math.round((inRangeCount / dayEntries.length) * 100);
    const hypoCount    = dayEntries.filter(e => e.sgv < thresholds.low).length;
    const zone         = glucoseZone(avg, thresholds);

    return {
      date: dateStr,
      weekday,
      isFutureDay: dayIsFuture,
      hasGlucoseData: true,
      avgGlucose: avg,
      minGlucose: min,
      maxGlucose: max,
      zone,
      tirPercent,
      hypoCount,
      sparkline: dayEntries.map(e => ({ t: e.date, v: e.sgv })),
      totalCarbs: round1(totalCarbs),
      totalRapidInsulin: round1(totalRapidInsulin),
      totalSlowInsulin: round1(totalSlowInsulin),
      hasTreatmentData: dayTreatments.length > 0,
    };
  });
}

function computeTotals(days: WeeklyDaySummary[]): WeekTotals {
  const withData = days.filter(d => d.hasGlucoseData);
  return {
    avgGlucose: withData.length
      ? Math.round(withData.reduce((s, d) => s + d.avgGlucose, 0) / withData.length)
      : null,
    tirPercent: withData.length
      ? Math.round(withData.reduce((s, d) => s + d.tirPercent, 0) / withData.length)
      : null,
    hypoCount:         days.reduce((s, d) => s + d.hypoCount, 0),
    totalCarbs:        Math.round(days.reduce((s, d) => s + d.totalCarbs,        0) * 10) / 10,
    totalRapidInsulin: Math.round(days.reduce((s, d) => s + d.totalRapidInsulin, 0) * 10) / 10,
    totalSlowInsulin:  Math.round(days.reduce((s, d) => s + d.totalSlowInsulin,  0) * 10) / 10,
  };
}

// ============================================================================
// WeeklyPage
// ============================================================================

export function WeeklyPage() {
  const { unit, alarmThresholds } = useDashboardStore();
  const ul = unitLabel(unit);

  const [weekStart, setWeekStart] = useState<Date>(() => startOfISOWeek(new Date()));
  const [days,    setDays]    = useState<WeeklyDaySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const isCurrentWeek = isSameWeek(weekStart, new Date(), { weekStartsOn: 1 });
  const weekEnd       = addDays(weekStart, 6);

  const thresholds = {
    veryLow:  alarmThresholds.veryLow  ?? 54,
    low:      alarmThresholds.low      ?? 70,
    high:     alarmThresholds.high     ?? 180,
    veryHigh: alarmThresholds.veryHigh ?? 250,
  };

  const fetchWeek = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const start = startOfISOWeek(weekStart).toISOString();
      const end   = endOfDay(addDays(weekStart, 6)).toISOString();
      const [entries, treatments] = await Promise.all([
        getGlucoseRange(start, end),
        getTreatments({ startDate: start, endDate: end, limit: 500 }),
      ]);
      setDays(aggregateWeek(entries, treatments, weekStart, {
        veryLow:  alarmThresholds.veryLow  ?? 54,
        low:      alarmThresholds.low      ?? 70,
        high:     alarmThresholds.high     ?? 180,
        veryHigh: alarmThresholds.veryHigh ?? 250,
      }));
    } catch {
      setError('Não foi possível carregar os dados da semana.');
    } finally {
      setLoading(false);
    }
  }, [weekStart, alarmThresholds]);

  useEffect(() => { fetchWeek(); }, [fetchWeek]);

  const totals = computeTotals(days);
  const hasSomeData = days.some(d => d.hasGlucoseData || d.hasTreatmentData);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <main className="container mx-auto px-4 py-4 max-w-6xl space-y-4">

      {/* ── Cabeçalho com navegação ──────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-5 w-5 text-primary" />
              <CardTitle>Resumo Semanal</CardTitle>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setWeekStart(d => subWeeks(d, 1))}
                title="Semana anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium w-48 text-center">
                {formatWeekRange(weekStart, weekEnd)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setWeekStart(d => addWeeks(d, 1))}
                disabled={isCurrentWeek}
                title="Próxima semana"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* ── Tabela semanal ───────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-4 px-2 sm:px-6">
          {error ? (
            <div className="text-center py-8 text-destructive text-sm">{error}</div>
          ) : loading ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse bg-muted/30 rounded" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 pr-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Data</th>
                    <th className="pb-2 pr-3 text-xs font-medium text-muted-foreground">Curva</th>
                    <th className="pb-2 pr-3 text-xs font-medium text-muted-foreground whitespace-nowrap">Média</th>
                    <th className="pb-2 pr-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Mín</th>
                    <th className="pb-2 pr-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Máx</th>
                    <th className="pb-2 pr-3 text-xs font-medium text-muted-foreground">TIR%</th>
                    <th className="pb-2 pr-3 text-xs font-medium text-muted-foreground">Carbos</th>
                    <th className="pb-2 pr-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Rápida</th>
                    <th className="pb-2 pr-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Lenta</th>
                    <th className="pb-2 text-xs font-medium text-muted-foreground">Hipos</th>
                  </tr>
                </thead>

                <tbody>
                  {days.map(day => (
                    <tr
                      key={day.date}
                      className={[
                        'border-b border-border/40 hover:bg-muted/20 transition-colors',
                        day.isFutureDay ? 'opacity-40' : '',
                      ].join(' ')}
                    >
                      {/* Data */}
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        <span className="font-medium">{day.weekday}</span>
                        <span className="text-muted-foreground text-xs ml-1.5">
                          {format(parseISO(day.date), 'd MMM', { locale: ptBR })}
                        </span>
                      </td>

                      {/* Sparkline */}
                      <td className="py-1 pr-3">
                        {day.hasGlucoseData ? (
                          <Sparkline
                            data={day.sparkline}
                            low={thresholds.low}
                            high={thresholds.high}
                            zone={day.zone}
                          />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>

                      {/* Média */}
                      <td className={`py-2.5 pr-3 font-semibold tabular-nums ${ZONE_AVG_TEXT[day.zone]}`}>
                        {day.hasGlucoseData ? `${formatGlucose(day.avgGlucose, unit)} ${ul}` : '—'}
                      </td>

                      {/* Mín */}
                      <td className="py-2.5 pr-3 tabular-nums text-orange-600 dark:text-orange-400 hidden sm:table-cell">
                        {day.hasGlucoseData ? formatGlucose(day.minGlucose, unit) : '—'}
                      </td>

                      {/* Máx */}
                      <td className="py-2.5 pr-3 tabular-nums text-red-600 dark:text-red-400 hidden sm:table-cell">
                        {day.hasGlucoseData ? formatGlucose(day.maxGlucose, unit) : '—'}
                      </td>

                      {/* TIR% */}
                      <td className={`py-2.5 pr-3 font-medium tabular-nums ${day.hasGlucoseData ? tirColor(day.tirPercent) : 'text-muted-foreground'}`}>
                        {day.hasGlucoseData ? `${day.tirPercent}%` : '—'}
                      </td>

                      {/* Carbos */}
                      <td className="py-2.5 pr-3 tabular-nums text-muted-foreground">
                        {fmtNum(day.totalCarbs, 'g')}
                      </td>

                      {/* Rápida (hidden < md) */}
                      <td className="py-2.5 pr-3 tabular-nums text-muted-foreground hidden md:table-cell">
                        {fmtNum(day.totalRapidInsulin, 'U')}
                      </td>

                      {/* Lenta (hidden < md) */}
                      <td className="py-2.5 pr-3 tabular-nums text-muted-foreground hidden md:table-cell">
                        {fmtNum(day.totalSlowInsulin, 'U')}
                      </td>

                      {/* Hipos */}
                      <td className={`py-2.5 tabular-nums font-medium ${day.hypoCount > 0 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                        {day.hypoCount > 0 ? day.hypoCount : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Footer: Totais / Médias */}
                {hasSomeData && (
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/20 font-semibold">
                      <td className="py-2.5 pr-3 text-xs text-muted-foreground whitespace-nowrap">Totais / Médias</td>
                      <td className="py-2.5 pr-3 text-muted-foreground text-xs">—</td>

                      {/* Avg */}
                      <td className="py-2.5 pr-3 tabular-nums">
                        {totals.avgGlucose !== null
                          ? `${formatGlucose(totals.avgGlucose, unit)} ${ul}`
                          : '—'}
                      </td>

                      {/* Mín (hidden) */}
                      <td className="py-2.5 pr-3 text-muted-foreground hidden sm:table-cell">—</td>
                      {/* Máx (hidden) */}
                      <td className="py-2.5 pr-3 text-muted-foreground hidden sm:table-cell">—</td>

                      {/* TIR% */}
                      <td className={`py-2.5 pr-3 tabular-nums ${totals.tirPercent !== null ? tirColor(totals.tirPercent) : ''}`}>
                        {totals.tirPercent !== null ? `${totals.tirPercent}%` : '—'}
                      </td>

                      {/* Carbos */}
                      <td className="py-2.5 pr-3 tabular-nums">
                        {fmtNum(totals.totalCarbs, 'g')}
                      </td>

                      {/* Rápida */}
                      <td className="py-2.5 pr-3 tabular-nums hidden md:table-cell">
                        {fmtNum(totals.totalRapidInsulin, 'U')}
                      </td>

                      {/* Lenta */}
                      <td className="py-2.5 pr-3 tabular-nums hidden md:table-cell">
                        {fmtNum(totals.totalSlowInsulin, 'U')}
                      </td>

                      {/* Hipos */}
                      <td className={`py-2.5 tabular-nums ${totals.hypoCount > 0 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                        {totals.hypoCount > 0 ? totals.hypoCount : '—'}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>

              {/* Legenda de unidades — aparece só em telas pequenas onde colunas estão ocultas */}
              <p className="text-[10px] text-muted-foreground mt-3 md:hidden">
                * Insulina rápida e lenta ocultas em telas pequenas. Abra em modo paisagem para ver todas as colunas.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
