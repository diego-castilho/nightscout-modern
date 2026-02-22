// ============================================================================
// CalendarPage — Resumo mensal de glicemia com grade colorida por zona TIR
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, getDaysInMonth, getDay, isToday, isFuture, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, AlertTriangle, CalendarDays } from 'lucide-react';
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useDashboardStore } from '../stores/dashboardStore';
import { getCalendarData, getGlucoseRange } from '../lib/api';
import type { CalendarDayData, GlucoseEntry } from '../lib/api';
import { formatGlucose, unitLabel } from '../lib/glucose';
import { GlucoseReferenceLines } from '../components/charts/GlucoseReferenceLines';

// ============================================================================
// Helpers de cor por zona
// ============================================================================

const ZONE_CELL: Record<CalendarDayData['zone'], string> = {
  inRange:  'bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700 hover:ring-2 hover:ring-green-400',
  high:     'bg-amber-100 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 hover:ring-2 hover:ring-amber-400',
  veryHigh: 'bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-700 hover:ring-2 hover:ring-red-400',
  low:      'bg-orange-100 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700 hover:ring-2 hover:ring-orange-400',
  veryLow:  'bg-red-200 dark:bg-red-950/40 border-red-400 dark:border-red-600 hover:ring-2 hover:ring-red-500',
  noData:   'bg-muted/20 border-border',
};

const ZONE_AVG_TEXT: Record<CalendarDayData['zone'], string> = {
  inRange:  'text-green-700 dark:text-green-400',
  high:     'text-amber-700 dark:text-amber-400',
  veryHigh: 'text-red-700 dark:text-red-400',
  low:      'text-orange-700 dark:text-orange-400',
  veryLow:  'text-red-800 dark:text-red-300',
  noData:   'text-muted-foreground',
};

// ============================================================================
// Mini-tooltip do gráfico de detalhe
// ============================================================================

function DayTooltip({ active, payload, unit }: {
  active?:  boolean;
  payload?: { value: number; payload: { time: string } }[];
  unit:     'mgdl' | 'mmol';
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-border rounded px-2 py-1 text-xs shadow">
      <p className="font-medium">{formatGlucose(payload[0].value, unit)} {unitLabel(unit)}</p>
      <p className="text-muted-foreground">{payload[0].payload.time}</p>
    </div>
  );
}

// ============================================================================
// CalendarPage
// ============================================================================

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function CalendarPage() {
  const { unit, alarmThresholds } = useDashboardStore();
  const ul = unitLabel(unit);
  const now = new Date();

  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-based

  const [data,       setData]       = useState<CalendarDayData[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  const [selectedDay,  setSelectedDay]  = useState<CalendarDayData | null>(null);
  const [dayEntries,   setDayEntries]   = useState<GlucoseEntry[]>([]);
  const [dayLoading,   setDayLoading]   = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchMonth = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedDay(null);
    setDayEntries([]);

    const firstDay = startOfMonth(new Date(year, month));
    const lastDay  = endOfMonth(firstDay);

    try {
      const result = await getCalendarData(
        firstDay.toISOString(),
        lastDay.toISOString(),
        alarmThresholds
      );
      setData(result);
    } catch {
      setError('Não foi possível carregar os dados do mês.');
    } finally {
      setLoading(false);
    }
  }, [year, month, alarmThresholds]);

  useEffect(() => { fetchMonth(); }, [fetchMonth]);

  // ── Detalhe do dia ────────────────────────────────────────────────────────

  async function handleDayClick(day: CalendarDayData) {
    if (day.zone === 'noData') return;
    if (selectedDay?.date === day.date) {
      setSelectedDay(null);
      setDayEntries([]);
      return;
    }
    setSelectedDay(day);
    setDayLoading(true);
    try {
      const dayDate = new Date(day.date + 'T00:00:00');
      const entries = await getGlucoseRange(
        startOfDay(dayDate).toISOString(),
        endOfDay(dayDate).toISOString()
      );
      setDayEntries(entries.sort((a, b) => a.date - b.date));
    } catch {
      setDayEntries([]);
    } finally {
      setDayLoading(false);
    }
  }

  // ── Navegação de meses ────────────────────────────────────────────────────

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else { setMonth(m => m - 1); }
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else { setMonth(m => m + 1); }
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  // ── Geração da grade ──────────────────────────────────────────────────────

  const firstDay  = new Date(year, month, 1);
  const daysCount = getDaysInMonth(firstDay);
  const startWDay = getDay(startOfMonth(firstDay)); // 0=Dom

  // Map date string → CalendarDayData
  const dataMap = new Map(data.map(d => [d.date, d]));

  // Células: blanks + dias do mês
  const cells: (CalendarDayData | null | 'future')[] = [
    ...Array(startWDay).fill(null),
    ...Array.from({ length: daysCount }, (_, i) => {
      const dayDate = new Date(year, month, i + 1);
      if (isFuture(startOfDay(dayDate)) && !isToday(dayDate)) return 'future';
      const key = format(dayDate, 'yyyy-MM-dd');
      return dataMap.get(key) ?? ({
        date: key, avgGlucose: 0, minGlucose: 0, maxGlucose: 0,
        readings: 0, hypoCount: 0, hypoSevere: 0, zone: 'noData',
      } as CalendarDayData);
    }),
  ];

  // ── Resumo do mês ─────────────────────────────────────────────────────────

  const withData = data.filter(d => d.zone !== 'noData');
  const monthAvg = withData.length
    ? Math.round(withData.reduce((s, d) => s + d.avgGlucose, 0) / withData.length)
    : null;
  const daysWithHypo    = withData.filter(d => d.hypoCount > 0).length;
  const daysInRange     = withData.filter(d => d.zone === 'inRange').length;
  const daysNoData      = daysCount - withData.length;
  const tirPct = withData.length ? Math.round((daysInRange / withData.length) * 100) : null;

  // ── Chart data para detalhe do dia ────────────────────────────────────────

  const chartData = dayEntries.map(e => ({
    time: format(new Date(e.date), 'HH:mm'),
    sgv: e.sgv,
  }));

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <main className="container mx-auto px-4 py-4 max-w-5xl space-y-4">

      {/* ── Cabeçalho + resumo ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <CardTitle>Calendário</CardTitle>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={prevMonth} title="Mês anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium w-36 text-center">
                {format(new Date(year, month), 'MMMM yyyy', { locale: ptBR })}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={nextMonth}
                disabled={isCurrentMonth}
                title="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Resumo do mês */}
        {!loading && !error && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Média do mês</p>
                <p className="text-lg font-bold">
                  {monthAvg !== null ? `${formatGlucose(monthAvg, unit)} ${ul}` : '—'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Dias no alvo</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                  {tirPct !== null ? `${tirPct}%` : '—'}
                  <span className="text-xs text-muted-foreground font-normal ml-1">
                    ({daysInRange}/{withData.length})
                  </span>
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Dias com hipo</p>
                <p className={`text-lg font-bold ${daysWithHypo > 0 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                  {daysWithHypo}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Dias sem dados</p>
                <p className="text-lg font-bold text-muted-foreground">{daysNoData}</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Grade do calendário ─────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-4">
          {error ? (
            <div className="text-center py-8 text-destructive text-sm">{error}</div>
          ) : (
            <>
              {/* Cabeçalho dos dias da semana */}
              <div className="grid grid-cols-7 mb-1">
                {WEEKDAYS.map(d => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Células */}
              <div className="grid grid-cols-7 gap-1">
                {cells.map((cell, idx) => {
                  if (cell === null) {
                    return <div key={`blank-${idx}`} />;
                  }

                  if (cell === 'future') {
                    const dayNum = idx - startWDay + 1;
                    return (
                      <div
                        key={`future-${idx}`}
                        className="border rounded-md p-1 opacity-25 cursor-default min-h-[64px] flex flex-col"
                      >
                        <span className="text-xs font-medium text-muted-foreground">{dayNum}</span>
                      </div>
                    );
                  }

                  const dayNum   = idx - startWDay + 1;
                  const dayDate  = new Date(year, month, dayNum);
                  const isSelected = selectedDay?.date === cell.date;
                  const todayDay = isToday(dayDate);
                  const noData   = cell.zone === 'noData';

                  return (
                    <button
                      key={cell.date}
                      onClick={() => handleDayClick(cell)}
                      disabled={noData}
                      className={[
                        'border rounded-md p-1 min-h-[64px] flex flex-col text-left transition-all',
                        ZONE_CELL[cell.zone],
                        isSelected ? 'ring-2 ring-primary ring-offset-1' : '',
                        noData ? 'cursor-default' : 'cursor-pointer',
                      ].join(' ')}
                    >
                      {/* Linha superior: número + badge hipo */}
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-xs ${todayDay ? 'font-bold text-primary' : 'font-medium text-foreground'}`}>
                          {dayNum}
                          {todayDay && <span className="ml-0.5 inline-block w-1 h-1 rounded-full bg-primary align-middle" />}
                        </span>
                        {cell.hypoCount > 0 && (
                          <span className="flex items-center gap-0.5 text-orange-600 dark:text-orange-400">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            <span className="text-[10px] font-medium">{cell.hypoCount}</span>
                          </span>
                        )}
                      </div>

                      {/* Glicemia média */}
                      <div className="flex-1 flex items-center justify-center">
                        {noData ? (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        ) : (
                          <span className={`text-xs font-semibold ${ZONE_AVG_TEXT[cell.zone]}`}>
                            {formatGlucose(cell.avgGlucose, unit)}
                          </span>
                        )}
                      </div>

                      {/* Contagem de leituras */}
                      {!noData && (
                        <div className="text-right">
                          <span className="text-[9px] text-muted-foreground">{cell.readings}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legenda */}
              {!loading && (
                <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-border justify-center">
                  {[
                    { zone: 'veryLow',  label: 'Muito baixo' },
                    { zone: 'low',      label: 'Baixo' },
                    { zone: 'inRange',  label: 'No alvo' },
                    { zone: 'high',     label: 'Alto' },
                    { zone: 'veryHigh', label: 'Muito alto' },
                    { zone: 'noData',   label: 'Sem dados' },
                  ].map(({ zone, label }) => (
                    <div key={zone} className="flex items-center gap-1">
                      <div className={`w-3 h-3 rounded border ${ZONE_CELL[zone as CalendarDayData['zone']].split(' ').slice(0, 2).join(' ')}`} />
                      <span className="text-[10px] text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Skeleton de carregamento */}
              {loading && (
                <div className="grid grid-cols-7 gap-1 mt-1">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <div key={i} className="border rounded-md min-h-[64px] animate-pulse bg-muted/30" />
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Detalhe do dia selecionado ──────────────────────────────────── */}
      {selectedDay && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {format(new Date(selectedDay.date + 'T12:00:00'), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Stats do dia */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4 text-sm">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Média</p>
                <p className="font-semibold">{formatGlucose(selectedDay.avgGlucose, unit)} {ul}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Mín</p>
                <p className="font-semibold text-orange-600 dark:text-orange-400">
                  {formatGlucose(selectedDay.minGlucose, unit)} {ul}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Máx</p>
                <p className="font-semibold text-red-600 dark:text-red-400">
                  {formatGlucose(selectedDay.maxGlucose, unit)} {ul}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Leituras</p>
                <p className="font-semibold">{selectedDay.readings}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Hipos (&lt;{alarmThresholds.low})</p>
                <p className={`font-semibold ${selectedDay.hypoCount > 0 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                  {selectedDay.hypoCount}
                </p>
              </div>
            </div>

            {/* Mini gráfico do dia */}
            {dayLoading ? (
              <div className="h-28 animate-pulse bg-muted/30 rounded" />
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={112}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                  <defs>
                    <linearGradient id="dayGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <Tooltip content={({ active, payload }) => (
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    <DayTooltip active={active} payload={payload as any} unit={unit} />
                  )} />
                  <GlucoseReferenceLines thresholds={alarmThresholds} unit={unit} which={['low', 'high']} showLabels={false} />
                  <Area
                    type="monotone"
                    dataKey="sgv"
                    stroke="#22c55e"
                    strokeWidth={1.5}
                    fill="url(#dayGradient)"
                    dot={false}
                    activeDot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Sem leituras detalhadas.</p>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
