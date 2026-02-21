// ============================================================================
// MealPatternsPage — Padrões de Refeição (Fase 6)
// Correlaciona refeições com resposta glicêmica: pré, +1h, +2h, pico
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { subDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Utensils } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useDashboardStore } from '../stores/dashboardStore';
import { getMealtimeData } from '../lib/api';
import type { MealtimeData, MealPeriodStats, MealEvent } from '../lib/api';
import { formatGlucose, unitLabel } from '../lib/glucose';
import { PERIOD_OPTIONS } from '../lib/periods';

// ============================================================================
// Constants
// ============================================================================

const PERIODS = PERIOD_OPTIONS;

const PERIOD_COLORS: Record<string, string> = {
  cafe_manha: '#f59e0b', // amber
  almoco:     '#3b82f6', // blue
  lanche:     '#10b981', // emerald
  jantar:     '#8b5cf6', // violet
  outro:      '#6b7280', // gray
};

// ============================================================================
// Sub-components
// ============================================================================

function glucoseClass(val: number | null, low: number, high: number): string {
  if (val === null) return 'text-muted-foreground';
  if (val < low)  return 'text-orange-500 font-semibold';
  if (val > high) return 'text-red-500 font-semibold';
  return 'text-green-600 dark:text-green-400 font-semibold';
}

interface SparklineProps {
  stats: MealPeriodStats;
  unit: 'mgdl' | 'mmol';
  low: number;
  high: number;
  color: string;
}

function ResponseSparkline({ stats, unit, low, high, color }: SparklineProps) {
  const points = [
    { label: 'Pré',  value: stats.avgPreMeal || null },
    { label: '+1h',  value: stats.avgAt1h    || null },
    { label: '+2h',  value: stats.avgAt2h    || null },
  ].filter((p) => p.value !== null);

  if (points.length < 2) return <p className="text-xs text-muted-foreground">Dados insuficientes</p>;

  const data = points.map((p) => ({
    label: p.label,
    value: unit === 'mmol' ? Math.round((p.value! / 18.018) * 10) / 10 : p.value,
  }));

  const tLow  = unit === 'mmol' ? Math.round((low  / 18.018) * 10) / 10 : low;
  const tHigh = unit === 'mmol' ? Math.round((high / 18.018) * 10) / 10 : high;

  return (
    <ResponsiveContainer width="100%" height={90}>
      <LineChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
        <YAxis
          domain={['auto', 'auto']}
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          width={30}
        />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
            fontSize: 12,
          }}
          formatter={((v: number) => [`${v} ${unitLabel(unit)}`, 'Glicemia']) as unknown as undefined}
        />
        <ReferenceLine y={tLow}  stroke="#f97316" strokeDasharray="4 2" strokeWidth={1} />
        <ReferenceLine y={tHigh} stroke="#22c55e" strokeDasharray="4 2" strokeWidth={1} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={{ fill: color, r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface PeriodCardProps {
  stats: MealPeriodStats;
  unit: 'mgdl' | 'mmol';
  low: number;
  high: number;
}

function PeriodCard({ stats, unit, low, high }: PeriodCardProps) {
  const [expanded, setExpanded] = useState(false);
  const color = PERIOD_COLORS[stats.period] ?? '#6b7280';

  const fmtGluc = (v: number | null) =>
    v ? `${formatGlucose(v, unit)} ${unitLabel(unit)}` : '—';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ background: color }}
          />
          {stats.label}
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {stats.count} refeição{stats.count !== 1 ? 's' : ''}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Glucose response profile chart */}
        <ResponseSparkline stats={stats} unit={unit} low={low} high={high} color={color} />

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Pré-refeição</p>
            <p className={glucoseClass(stats.avgPreMeal, low, high)}>
              {fmtGluc(stats.avgPreMeal)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">+1 hora</p>
            <p className={glucoseClass(stats.avgAt1h, low, high)}>
              {fmtGluc(stats.avgAt1h)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">+2 horas</p>
            <p className={glucoseClass(stats.avgAt2h, low, high)}>
              {fmtGluc(stats.avgAt2h)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Pico (Δ)</p>
            <p className="font-semibold">
              {stats.avgPeak ? `${formatGlucose(stats.avgPeak, unit)} ${unitLabel(unit)}` : '—'}
              {stats.avgDelta > 0 && (
                <span className="text-xs text-muted-foreground ml-1">(+{stats.avgDelta})</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex gap-4 text-sm">
          <span className="text-muted-foreground">
            Carbos médio: <strong>{stats.avgCarbs} g</strong>
          </span>
          <span className="text-muted-foreground">
            Insulina média: <strong>{stats.avgInsulin} U</strong>
          </span>
        </div>

        {/* Expandable events table */}
        <button
          className="text-xs text-primary underline-offset-2 hover:underline"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Ocultar eventos' : `Ver ${stats.events.length} evento${stats.events.length !== 1 ? 's' : ''}`}
        </button>

        {expanded && (
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-1 pr-2">Data/Hora</th>
                  <th className="text-right pr-2">Carbos</th>
                  <th className="text-right pr-2">Ins.</th>
                  <th className="text-right pr-2">Pré</th>
                  <th className="text-right pr-2">+1h</th>
                  <th className="text-right pr-2">+2h</th>
                  <th className="text-right">Pico</th>
                </tr>
              </thead>
              <tbody>
                {stats.events.map((ev: MealEvent) => (
                  <tr key={ev.treatmentId} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-1 pr-2 text-muted-foreground">
                      {format(new Date(ev.timestamp), "dd/MM HH:mm", { locale: ptBR })}
                    </td>
                    <td className="text-right pr-2">{ev.carbs > 0 ? `${ev.carbs}g` : '—'}</td>
                    <td className="text-right pr-2">{ev.insulin > 0 ? `${ev.insulin}U` : '—'}</td>
                    <td className={`text-right pr-2 ${glucoseClass(ev.preMealGlucose, low, high)}`}>
                      {ev.preMealGlucose ? formatGlucose(ev.preMealGlucose, unit) : '—'}
                    </td>
                    <td className={`text-right pr-2 ${glucoseClass(ev.glucoseAt1h, low, high)}`}>
                      {ev.glucoseAt1h ? formatGlucose(ev.glucoseAt1h, unit) : '—'}
                    </td>
                    <td className={`text-right pr-2 ${glucoseClass(ev.glucoseAt2h, low, high)}`}>
                      {ev.glucoseAt2h ? formatGlucose(ev.glucoseAt2h, unit) : '—'}
                    </td>
                    <td className={`text-right ${glucoseClass(ev.peakGlucose, low, high)}`}>
                      {ev.peakGlucose ? formatGlucose(ev.peakGlucose, unit) : '—'}
                      {ev.peakDelta !== null && ev.peakDelta > 0 && (
                        <span className="text-muted-foreground ml-0.5">(+{ev.peakDelta})</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export function MealPatternsPage() {
  const { unit, alarmThresholds } = useDashboardStore();

  const low  = alarmThresholds?.low  ?? 70;
  const high = alarmThresholds?.high ?? 180;

  const [periodDays, setPeriodDays] = useState(14);
  const [data, setData]             = useState<MealtimeData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const end   = new Date();
      const start = subDays(end, periodDays);
      const result = await getMealtimeData(
        start.toISOString(),
        end.toISOString()
      );
      setData(result);
    } catch (err) {
      setError('Erro ao carregar dados de refeições.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [periodDays]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <main className="container mx-auto px-4 py-4 max-w-5xl space-y-4">
      {/* Header card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Utensils className="h-5 w-5 text-primary" />
            Padrões de Refeição
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
            {PERIODS.map((p) => (
              <Button
                key={p.days}
                variant={periodDays === p.days ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriodDays(p.days)}
              >
                {p.label}
              </Button>
            ))}
            {data && !loading && (
              <span className="text-sm text-muted-foreground ml-auto">
                {data.totalEvents} refeição{data.totalEvents !== 1 ? 's' : ''} encontrada{data.totalEvents !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading state */}
      {loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Carregando padrões de refeição...
          </CardContent>
        </Card>
      )}

      {/* Error state */}
      {!loading && error && (
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      {/* No data */}
      {!loading && !error && data && data.periods.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-2">
            <Utensils className="h-10 w-10 mx-auto opacity-30" />
            <p>Nenhuma refeição registrada no período selecionado.</p>
            <p className="text-xs">
              Registre refeições (Meal Bolus / Snack Bolus) no Careportal para ver análises aqui.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Period cards */}
      {!loading && !error && data && data.periods.map((ps) => (
        <PeriodCard
          key={ps.period}
          stats={ps}
          unit={unit}
          low={low}
          high={high}
        />
      ))}
    </main>
  );
}
