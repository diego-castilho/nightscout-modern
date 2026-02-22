// ============================================================================
// SpaghettiPage — Gráfico Spaghetti Semanal (Fase 8)
// Perfis glicêmicos diários sobrepostos num eixo de 24 horas
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, subDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useDashboardStore } from '../stores/dashboardStore';
import { getGlucoseRange } from '../lib/api';
import type { GlucoseEntry } from '../lib/api';
import { formatGlucose, unitLabel } from '../lib/glucose';
import { PERIOD_OPTIONS } from '../lib/periods';
import { GlucoseReferenceLines } from '../components/charts/GlucoseReferenceLines';

// ============================================================================
// Constants
// ============================================================================

const PERIODS = PERIOD_OPTIONS.slice(0, 2);

// 14 distinct colours for up to 14 day lines
const SPAGHETTI_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ef4444', // red
  '#84cc16', // lime
  '#14b8a6', // teal
  '#a855f7', // purple
  '#fb923c', // orange-400
  '#0ea5e9', // sky
  '#d946ef', // fuchsia
];

// X-axis: one slot every 5 minutes (0 … 1440)
const TIME_GRID = Array.from({ length: 289 }, (_, i) => i * 5);
const X_TICKS   = [0, 180, 360, 540, 720, 900, 1080, 1260, 1440];

function minuteToLabel(min: number): string {
  const h = Math.floor(min / 60);
  return `${h.toString().padStart(2, '0')}:00`;
}

// ============================================================================
// Custom Tooltip
// ============================================================================

interface SpaghettiTooltipProps {
  active?:    boolean;
  payload?:   readonly any[];
  label?:     number;
  unit:       'mgdl' | 'mmol';
  dayLabels:  string[];
  hiddenDays: Set<number>;
}

function SpaghettiTooltip({ active, payload, label, unit, dayLabels, hiddenDays }: SpaghettiTooltipProps) {
  if (!active || !payload?.length || label === undefined) return null;
  const valid = payload.filter((p) => {
    if (p.value === undefined || p.value === null) return false;
    const idx = parseInt(p.dataKey.replace('day', ''), 10);
    return !hiddenDays.has(idx);
  });
  if (valid.length === 0) return null;
  const h = Math.floor(label / 60);
  const m = label % 60;
  const u = unitLabel(unit);
  return (
    <div className="bg-card border border-border rounded-md p-2 text-xs shadow-lg space-y-0.5 max-w-[190px]">
      <p className="font-semibold">{`${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`}</p>
      {valid.map((p: any) => {
        const idx = parseInt(p.dataKey.replace('day', ''), 10);
        return (
          <div key={p.dataKey} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.stroke }} />
            <span className="text-muted-foreground truncate flex-1">{dayLabels[idx]}</span>
            <span className="font-medium ml-1">{formatGlucose(p.value, unit)} {u}</span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Per-day stats table
// ============================================================================

interface DayStat {
  date:    Date;
  color:   string;
  count:   number;
  avg:     number;
  min:     number;
  max:     number;
  tirPct:  number;
  hypoPct: number;
}

interface DayStatsTableProps {
  stats:      DayStat[];
  unit:       'mgdl' | 'mmol';
  low:        number;
  high:       number;
  hiddenDays: Set<number>;
  onToggle:   (i: number) => void;
}

function DayStatsTable({ stats, unit, low, high, hiddenDays, onToggle }: DayStatsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="text-left py-1.5 pr-3">Dia</th>
            <th className="text-right pr-3">Leituras</th>
            <th className="text-right pr-3">Média</th>
            <th className="text-right pr-3">Mín</th>
            <th className="text-right pr-3">Máx</th>
            <th className="text-right pr-3">TIR%</th>
            <th className="text-right">Hipo%</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s, i) => {
            const hidden = hiddenDays.has(i);
            const f = (v: number) => `${formatGlucose(v, unit)} ${unitLabel(unit)}`;
            return (
              <tr
                key={i}
                className={`border-b border-border/50 hover:bg-muted/30 transition-opacity ${hidden ? 'opacity-35' : ''}`}
              >
                <td className="py-1.5 pr-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      title={hidden ? 'Mostrar dia' : 'Ocultar dia'}
                      onClick={() => onToggle(i)}
                      className="inline-block w-3 h-3 rounded-full flex-shrink-0 cursor-pointer ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      style={{
                        background:  hidden ? 'transparent' : s.color,
                        border:      `2px solid ${s.color}`,
                      }}
                    />
                    <span className="font-medium">
                      {format(s.date, 'EEE dd/MM', { locale: ptBR })}
                    </span>
                  </div>
                </td>
                <td className="text-right pr-3 text-muted-foreground">{s.count}</td>
                <td className={`text-right pr-3 font-medium ${
                  s.count === 0  ? 'text-muted-foreground'
                  : s.avg < low  ? 'text-orange-500'
                  : s.avg > high ? 'text-amber-500'
                  : 'text-green-600 dark:text-green-400'
                }`}>
                  {s.count > 0 ? f(s.avg) : '—'}
                </td>
                <td className={`text-right pr-3 ${s.count > 0 && s.min < low ? 'text-orange-500' : ''}`}>
                  {s.count > 0 ? f(s.min) : '—'}
                </td>
                <td className={`text-right pr-3 ${s.count > 0 && s.max > high ? 'text-amber-500' : ''}`}>
                  {s.count > 0 ? f(s.max) : '—'}
                </td>
                <td className={`text-right pr-3 font-medium ${
                  s.count === 0      ? 'text-muted-foreground'
                  : s.tirPct >= 70   ? 'text-green-600 dark:text-green-400'
                  : 'text-amber-500'
                }`}>
                  {s.count > 0 ? `${s.tirPct}%` : '—'}
                </td>
                <td className={`text-right font-medium ${s.count > 0 && s.hypoPct > 4 ? 'text-red-500' : ''}`}>
                  {s.count > 0 ? `${s.hypoPct}%` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export function SpaghettiPage() {
  const { unit, alarmThresholds } = useDashboardStore();
  const low  = alarmThresholds?.low  ?? 70;
  const high = alarmThresholds?.high ?? 180;

  const [periodDays, setPeriodDays] = useState(7);
  const [offset, setOffset]         = useState(0); // 0 = most recent period, 1 = one period back, …
  const [entries, setEntries]       = useState<GlucoseEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [hiddenDays, setHiddenDays] = useState<Set<number>>(new Set());

  // Reset hidden state when period or offset changes
  useEffect(() => { setHiddenDays(new Set()); }, [periodDays, offset]);

  const toggleDay = (i: number) =>
    setHiddenDays((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });

  // Date range ─ endDate uses 'now' so today's partial data is included
  const endDate = useMemo(() => {
    if (offset === 0) return new Date();
    return subDays(startOfDay(new Date()), offset * periodDays);
  }, [offset, periodDays]);

  const startDate = useMemo(
    () => subDays(startOfDay(endDate), periodDays),
    [endDate, periodDays]
  );

  // Ordered list of days for chart lines and table rows
  const days = useMemo(() => {
    const endDay = startOfDay(endDate);
    return Array.from({ length: periodDays }, (_, i) =>
      subDays(endDay, periodDays - 1 - i)
    );
  }, [endDate, periodDays]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getGlucoseRange(startDate.toISOString(), endDate.toISOString());
      setEntries(data);
    } catch (err) {
      setError('Erro ao carregar dados.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [startDate.toISOString(), endDate.toISOString()]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Group entries by local date key
  const entriesByDay = useMemo(() => {
    const map = new Map<string, GlucoseEntry[]>();
    for (const e of entries) {
      const key = format(new Date(e.date), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [entries]);

  // Build wide-format chart data: { time, day0, day1, … }
  // Each dayN slot is the sgv snapped to the nearest 5-minute mark
  const chartData = useMemo(() => {
    // Per-day slot maps
    const slotMaps = days.map((day) => {
      const key = format(day, 'yyyy-MM-dd');
      const map = new Map<number, number>();
      for (const e of (entriesByDay.get(key) ?? [])) {
        const min  = new Date(e.date).getHours() * 60 + new Date(e.date).getMinutes();
        const slot = Math.round(min / 5) * 5;
        if (!map.has(slot)) map.set(slot, e.sgv);
      }
      return map;
    });

    return TIME_GRID.map((slot) => {
      const pt: Record<string, number> = { time: slot };
      for (let i = 0; i < days.length; i++) {
        const v = slotMaps[i].get(slot);
        if (v !== undefined) pt[`day${i}`] = v;
      }
      return pt;
    });
  }, [days, entriesByDay]);

  // Per-day statistics
  const dayStats = useMemo((): DayStat[] => {
    return days.map((day, i) => {
      const key     = format(day, 'yyyy-MM-dd');
      const dayEnts = entriesByDay.get(key) ?? [];
      const count   = dayEnts.length;
      const color   = SPAGHETTI_COLORS[i % SPAGHETTI_COLORS.length];
      if (count === 0) return { date: day, color, count: 0, avg: 0, min: 0, max: 0, tirPct: 0, hypoPct: 0 };
      const values  = dayEnts.map((e) => e.sgv);
      const avg     = Math.round(values.reduce((s, v) => s + v, 0) / count);
      const inRange = values.filter((v) => v >= low && v <= high).length;
      const hypo    = values.filter((v) => v < low).length;
      return {
        date:    day,
        color,
        count,
        avg,
        min:     Math.min(...values),
        max:     Math.max(...values),
        tirPct:  Math.round((inRange / count) * 100),
        hypoPct: Math.round((hypo    / count) * 100),
      };
    });
  }, [days, entriesByDay, low, high]);

  const dayLabels  = days.map((d) => format(d, 'EEE dd/MM', { locale: ptBR }));

  const periodLabel = `${format(startDate, 'dd/MM', { locale: ptBR })} – ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })}`;

  const hasData = dayStats.some((s) => s.count > 0);

  return (
    <main className="container mx-auto px-4 py-4 max-w-5xl space-y-4">

      {/* ── Header card ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Gráfico Spaghetti
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {PERIODS.map((p) => (
              <Button
                key={p.days}
                variant={periodDays === p.days ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setPeriodDays(p.days); setOffset(0); }}
              >
                {p.label}
              </Button>
            ))}

            {/* Period navigation */}
            <div className="flex items-center gap-1 ml-auto">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setOffset((o) => o + 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm min-w-[165px] text-center">{periodLabel}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={offset === 0}
                onClick={() => setOffset((o) => Math.max(0, o - 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {!loading && (
              <span className="text-xs text-muted-foreground">
                {entries.length} leituras
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Carregando dados...
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {!loading && error && (
        <Card>
          <CardContent className="py-8 text-center text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* ── Spaghetti chart ── */}
      {!loading && !error && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Perfis glicêmicos sobrepostos — 24 horas
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                clique na legenda ou na bolinha da tabela para ocultar/mostrar um dia
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!hasData ? (
              <p className="text-center text-muted-foreground py-8">Nenhuma leitura no período.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={380}>
                  <LineChart data={chartData} margin={{ top: 8, right: 20, bottom: 24, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="time"
                      type="number"
                      domain={[0, 1440]}
                      ticks={X_TICKS}
                      tickFormatter={minuteToLabel}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      label={{
                        value: 'Hora do dia',
                        position: 'insideBottom',
                        offset: -12,
                        fontSize: 11,
                        fill: 'hsl(var(--muted-foreground))',
                      }}
                    />
                    <YAxis
                      domain={[40, 350]}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(v) =>
                        unit === 'mmol' ? (v / 18.018).toFixed(1) : String(v)
                      }
                      label={{
                        value: unitLabel(unit),
                        angle: -90,
                        position: 'insideLeft',
                        offset: 12,
                        fontSize: 11,
                        fill: 'hsl(var(--muted-foreground))',
                      }}
                      width={44}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => (
                        <SpaghettiTooltip
                          active={active}
                          payload={payload}
                          label={label as number | undefined}
                          unit={unit}
                          dayLabels={dayLabels}
                          hiddenDays={hiddenDays}
                        />
                      )}
                    />
                    <GlucoseReferenceLines thresholds={alarmThresholds} unit={unit} which={['low', 'high']} />
                    {days.map((day, i) => (
                      <Line
                        key={format(day, 'yyyy-MM-dd')}
                        type="monotone"
                        dataKey={`day${i}`}
                        stroke={SPAGHETTI_COLORS[i % SPAGHETTI_COLORS.length]}
                        strokeWidth={1.5}
                        dot={false}
                        connectNulls={false}
                        isAnimationActive={false}
                        hide={hiddenDays.has(i)}
                        name={dayLabels[i]}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>

                {/* Compact clickable legend */}
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs mt-3">
                  {days.map((day, i) => {
                    const hidden = hiddenDays.has(i);
                    const color  = SPAGHETTI_COLORS[i % SPAGHETTI_COLORS.length];
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleDay(i)}
                        title={hidden ? 'Mostrar dia' : 'Ocultar dia'}
                        className={`flex items-center gap-1.5 cursor-pointer rounded transition-opacity hover:opacity-80 ${hidden ? 'opacity-35' : ''}`}
                      >
                        <span
                          className="inline-block w-6 border-t-2 flex-shrink-0 transition-colors"
                          style={{ borderColor: hidden ? 'hsl(var(--muted-foreground))' : color }}
                        />
                        <span className="text-muted-foreground">
                          {format(day, 'EEE dd/MM', { locale: ptBR })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Per-day stats table ── */}
      {!loading && !error && hasData && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Estatísticas por dia</CardTitle>
          </CardHeader>
          <CardContent>
            <DayStatsTable
              stats={dayStats}
              unit={unit}
              low={low}
              high={high}
              hiddenDays={hiddenDays}
              onToggle={toggleDay}
            />
          </CardContent>
        </Card>
      )}

    </main>
  );
}
