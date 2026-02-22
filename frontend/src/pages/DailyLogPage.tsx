// ============================================================================
// DailyLogPage — Log diário: gráfico 24h com anotações de tratamentos
// Fase 5 do roadmap de relatórios clínicos
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, subDays, addDays, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
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

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useDashboardStore } from '../stores/dashboardStore';
import { getGlucoseRange, getTreatments } from '../lib/api';
import type { GlucoseEntry, Treatment } from '../lib/api';
import type { AlarmThresholds } from '../stores/dashboardStore';
import { formatGlucose, unitLabel } from '../lib/glucose';
import { RAPID_TYPES, SLOW_TYPES, treatmentCategory, treatmentLabel } from '../lib/treatments';
import { GlucoseReferenceLines } from '../components/charts/GlucoseReferenceLines';

const CAT_COLOR: Record<string, string> = {
  rapid: '#3b82f6',
  slow:  '#8b5cf6',
  carbs: '#f97316',
  other: '#9ca3af',
};

// ============================================================================
// Day stats computation
// ============================================================================

interface DayStats {
  readings:   number;
  avg:        number;
  min:        number;
  max:        number;
  pInRange:   number;
  hypos:      number;
  totalRapid: number;
  totalSlow:  number;
  totalCarbs: number;
}

function computeDayStats(
  entries:    GlucoseEntry[],
  treatments: Treatment[],
  t:          AlarmThresholds
): DayStats {
  const total = entries.length;
  const values = entries.map((e) => e.sgv);

  const totalRapid = treatments
    .filter((tr) => RAPID_TYPES.has(tr.eventType))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .reduce((s, tr: any) => s + (tr.insulin || 0) + (tr.immediateInsulin || 0) + (tr.extendedInsulin || 0), 0);
  const totalSlow = treatments
    .filter((tr) => SLOW_TYPES.has(tr.eventType))
    .reduce((s, tr) => s + (tr.insulin || 0), 0);
  const totalCarbs = treatments.reduce((s, tr) => s + (tr.carbs || 0), 0);

  const base = {
    totalRapid: Math.round(totalRapid * 10) / 10,
    totalSlow:  Math.round(totalSlow  * 10) / 10,
    totalCarbs: Math.round(totalCarbs),
  };

  if (total === 0) {
    return { readings: 0, avg: 0, min: 0, max: 0, pInRange: 0, hypos: 0, ...base };
  }

  const avg  = Math.round(values.reduce((s, v) => s + v, 0) / total);
  const min  = Math.min(...values);
  const max  = Math.max(...values);
  const pct  = (fn: (v: number) => boolean) =>
    Math.round(values.filter(fn).length / total * 1000) / 10;

  return {
    readings: total,
    avg,
    min,
    max,
    pInRange: pct((v) => v >= t.low && v <= t.high),
    hypos:    values.filter((v) => v < t.low).length,
    ...base,
  };
}

// ============================================================================
// Sub-components
// ============================================================================

function StatPill({
  label, value, unit, warn,
}: { label: string; value: string; unit?: string; warn?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-muted/40 text-center">
      <div className={`text-base sm:text-lg font-bold tabular-nums ${warn ? 'text-red-500' : ''}`}>
        {value}
        {unit && <span className="text-xs font-normal text-muted-foreground ml-0.5">{unit}</span>}
      </div>
      <div className="text-xs text-muted-foreground leading-tight">{label}</div>
    </div>
  );
}

function ChartTooltip({ active, payload, unit }: {
  active?:  boolean;
  payload?: Array<{ payload: { date: number; sgv: number } }>;
  unit:     'mgdl' | 'mmol';
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-background border border-border rounded-md shadow p-2 text-xs">
      <div className="text-muted-foreground mb-0.5">{format(new Date(d.date), 'HH:mm')}</div>
      <div className="font-bold">{formatGlucose(d.sgv, unit)} {unitLabel(unit)}</div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export function DailyLogPage() {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [dateStr, setDateStr]         = useState(todayStr);
  const [entries, setEntries]         = useState<GlucoseEntry[]>([]);
  const [treatments, setTreatments]   = useState<Treatment[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  const { alarmThresholds, unit } = useDashboardStore();
  const ul = unitLabel(unit);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchDay = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const startDate = new Date(dateStr + 'T00:00:00').toISOString();
      const endDate   = new Date(dateStr + 'T23:59:59.999').toISOString();
      const [ents, treats] = await Promise.all([
        getGlucoseRange(startDate, endDate),
        getTreatments({ startDate, endDate, limit: 200 }),
      ]);
      setEntries(ents);
      setTreatments(treats);
    } catch {
      setError('Falha ao carregar dados do dia.');
    } finally {
      setLoading(false);
    }
  }, [dateStr]);

  useEffect(() => { fetchDay(); }, [fetchDay]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const stats = useMemo(
    () => computeDayStats(entries, treatments, alarmThresholds),
    [entries, treatments, alarmThresholds]
  );

  const glucoseData = useMemo(
    () => entries.map((e) => ({ date: e.date, sgv: e.sgv })),
    [entries]
  );

  const hourlyStats = useMemo(() =>
    Array.from({ length: 24 }, (_, h) => {
      const vs = entries
        .filter((e) => new Date(e.date).getHours() === h)
        .map((e) => e.sgv);
      if (vs.length === 0) return { hour: h, count: 0, avg: null as number | null, min: null as number | null, max: null as number | null };
      return {
        hour:  h,
        count: vs.length,
        avg:   Math.round(vs.reduce((s, v) => s + v, 0) / vs.length),
        min:   Math.min(...vs),
        max:   Math.max(...vs),
      };
    }),
    [entries]
  );

  // ── Chart config ───────────────────────────────────────────────────────────
  const startTs = new Date(dateStr + 'T00:00:00').getTime();
  const endTs   = startTs + 24 * 3_600_000;
  const xTicks  = Array.from({ length: 13 }, (_, i) => startTs + i * 2 * 3_600_000);

  // Treatment vertical lines (memoized JSX)
  const treatmentLines = useMemo(() =>
    treatments.flatMap((t, i) => {
      const ts = new Date(t.created_at).getTime();
      if (ts < startTs || ts > endTs) return [];
      const cat   = treatmentCategory(t);
      const color = CAT_COLOR[cat];
      const label = treatmentLabel(t);
      return [(
        <ReferenceLine
          key={i}
          x={ts}
          stroke={color}
          strokeWidth={1}
          strokeOpacity={0.7}
          label={label ? { value: label, position: 'insideTop', fontSize: 7, fill: color } : undefined}
        />
      )];
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [treatments, startTs, endTs]
  );

  // ── Date navigation ────────────────────────────────────────────────────────
  const isToday = dateStr === todayStr;

  function prevDay() {
    const d = parse(dateStr, 'yyyy-MM-dd', new Date());
    setDateStr(format(subDays(d, 1), 'yyyy-MM-dd'));
  }
  function nextDay() {
    const d = parse(dateStr, 'yyyy-MM-dd', new Date());
    setDateStr(format(addDays(d, 1), 'yyyy-MM-dd'));
  }

  const displayDate = format(
    parse(dateStr, 'yyyy-MM-dd', new Date()),
    "EEEE, d 'de' MMMM 'de' yyyy",
    { locale: ptBR }
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main className="container mx-auto px-4 py-4 max-w-5xl space-y-4">

      {/* Header — date navigator */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4 text-primary" />
              Log Diário
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevDay}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <input
                type="date"
                value={dateStr}
                max={todayStr}
                onChange={(e) => { if (e.target.value) setDateStr(e.target.value); }}
                className="h-8 px-2 text-sm rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={nextDay}
                disabled={isToday}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              {!isToday && (
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setDateStr(todayStr)}>
                  Hoje
                </Button>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground capitalize mt-0.5">{displayDate}</p>
        </CardHeader>
      </Card>

      {loading && (
        <div className="text-center text-muted-foreground text-sm py-8">Carregando…</div>
      )}
      {error && (
        <div className="text-center text-destructive text-sm py-4">{error}</div>
      )}

      {!loading && !error && (
        <>
          {/* Stats summary */}
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            <StatPill label="Leituras"  value={stats.readings.toString()} />
            <StatPill
              label="Média"
              value={stats.readings > 0 ? formatGlucose(stats.avg, unit) : '—'}
              unit={stats.readings > 0 ? ul : undefined}
            />
            <StatPill
              label="TIR"
              value={stats.readings > 0 ? `${stats.pInRange}%` : '—'}
              warn={stats.readings > 0 && stats.pInRange < 50}
            />
            <StatPill
              label="Hipos"
              value={stats.hypos.toString()}
              warn={stats.hypos > 0}
            />
            <StatPill label="Carbos"     value={`${stats.totalCarbs}g`} />
            <StatPill label="Ins. rápida" value={`${stats.totalRapid}U`} />
            <StatPill label="Ins. lenta"  value={`${stats.totalSlow}U`} />
            <StatPill
              label="Min / Máx"
              value={stats.readings > 0
                ? `${formatGlucose(stats.min, unit)} / ${formatGlucose(stats.max, unit)}`
                : '—'}
            />
          </div>

          {/* 24h glucose chart */}
          <Card>
            <CardHeader className="pb-1 pt-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex flex-wrap items-center justify-between gap-2">
                <span>Glicemia — 24 horas</span>
                <span className="flex items-center gap-3 text-xs font-normal">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                    Bolus
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-violet-500" />
                    Basal
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
                    Carbos
                  </span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              {glucoseData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                  Sem leituras para este dia.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart
                    data={glucoseData}
                    margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
                  >
                    <defs>
                      <linearGradient id="dailyFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="date"
                      type="number"
                      scale="time"
                      domain={[startTs, endTs]}
                      ticks={xTicks}
                      tickFormatter={(v) =>
                        `${new Date(v).getHours().toString().padStart(2, '0')}h`
                      }
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      domain={[40, 400]}
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                      width={36}
                    />
                    <Tooltip content={({ active, payload }) => (
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      <ChartTooltip active={active} payload={payload as any} unit={unit} />
                    )} />
                    {/* Threshold lines */}
                    <GlucoseReferenceLines thresholds={alarmThresholds} unit={unit} which={['low', 'high']} showLabels={false} />
                    {/* Treatment annotations */}
                    {treatmentLines}
                    {/* Glucose area */}
                    <Area
                      type="monotone"
                      dataKey="sgv"
                      stroke="#22c55e"
                      strokeWidth={1.5}
                      fill="url(#dailyFill)"
                      dot={false}
                      isAnimationActive={false}
                      connectNulls={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Hourly stats table */}
          {entries.length > 0 && (
            <Card>
              <CardHeader className="pb-1 pt-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Stats por Hora
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 pt-0 overflow-x-auto">
                <table className="w-full text-xs tabular-nums">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-1.5 pr-3 font-medium w-12">Hora</th>
                      <th className="text-right py-1.5 px-2 font-medium w-8">n</th>
                      <th className="text-right py-1.5 px-2 font-medium">Média</th>
                      <th className="text-right py-1.5 px-2 font-medium">Mín</th>
                      <th className="text-right py-1.5 px-2 font-medium">Máx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hourlyStats.map(({ hour, count, avg, min, max }) => (
                      <tr
                        key={hour}
                        className={
                          count === 0
                            ? 'opacity-25'
                            : 'border-b border-border/30 hover:bg-muted/30'
                        }
                      >
                        <td className="py-1 pr-3 font-medium text-muted-foreground">
                          {hour.toString().padStart(2, '0')}:00
                        </td>
                        <td className="text-right py-1 px-2 text-muted-foreground">
                          {count > 0 ? count : '—'}
                        </td>
                        <td className="text-right py-1 px-2">
                          {avg !== null ? formatGlucose(avg, unit) : '—'}
                        </td>
                        <td className="text-right py-1 px-2 text-orange-500">
                          {min !== null ? formatGlucose(min, unit) : '—'}
                        </td>
                        <td className="text-right py-1 px-2 text-amber-500">
                          {max !== null ? formatGlucose(max, unit) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </main>
  );
}
