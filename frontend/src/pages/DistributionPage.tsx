// ============================================================================
// DistributionPage — Histograma + métricas avançadas de variabilidade
// Fase 4 do roadmap de relatórios clínicos
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { subDays } from 'date-fns';
import { BarChart } from 'lucide-react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useDashboardStore } from '../stores/dashboardStore';
import { getDistributionStats } from '../lib/api';
import type { DistributionStats } from '../lib/api';
import type { AlarmThresholds } from '../stores/dashboardStore';
import { formatGlucose, unitLabel } from '../lib/glucose';

// ============================================================================
// Constants
// ============================================================================

const PERIODS = [
  { label: '7 dias',  days: 7  },
  { label: '14 dias', days: 14 },
  { label: '30 dias', days: 30 },
];

// ============================================================================
// Helpers
// ============================================================================

function binZoneColor(bin: number, t: AlarmThresholds): string {
  const center = bin + 5;
  if (center < t.veryLow)  return '#dc2626';
  if (center < t.low)      return '#f97316';
  if (center <= t.high)    return '#22c55e';
  if (center <= t.veryHigh) return '#f59e0b';
  return '#ef4444';
}

function gviQuality(gvi: number): 'good' | 'moderate' | 'high' {
  if (gvi < 1.2) return 'good';
  if (gvi < 1.5) return 'moderate';
  return 'high';
}

function jQuality(j: number): 'good' | 'moderate' | 'high' {
  if (j < 20) return 'good';
  if (j < 40) return 'moderate';
  return 'high';
}

function tifQuality(tif: number): 'good' | 'moderate' | 'high' {
  if (tif < 15) return 'good';
  if (tif < 30) return 'moderate';
  return 'high';
}

const QUALITY_COLOR: Record<'good' | 'moderate' | 'high', string> = {
  good:     'text-green-500',
  moderate: 'text-amber-500',
  high:     'text-red-500',
};

// ============================================================================
// Sub-components
// ============================================================================

interface MetricCardProps {
  title: string;
  value: string;
  unit?: string;
  description: string;
  quality?: 'good' | 'moderate' | 'high';
}

function MetricCard({ title, value, unit, description, quality }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="pb-1 pt-3 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3 px-4">
        <div className={`text-2xl font-bold tabular-nums ${quality ? QUALITY_COLOR[quality] : ''}`}>
          {value}
          {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
        </div>
        <p className="text-xs text-muted-foreground mt-1 leading-snug">{description}</p>
      </CardContent>
    </Card>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length || label === undefined) return null;
  return (
    <div className="bg-background border border-border rounded-md shadow-lg p-2 text-xs min-w-[120px]">
      <div className="font-medium mb-1">{label}–{label + 10} mg/dL</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color }} className="flex justify-between gap-3">
          <span>{p.name}</span>
          <span className="font-medium">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}%</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export function DistributionPage() {
  const [periodDays, setPeriodDays] = useState(14);
  const [data, setData]             = useState<DistributionStats | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const { alarmThresholds, unit } = useDashboardStore();

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endDate   = new Date();
      const startDate = subDays(endDate, periodDays);
      const result = await getDistributionStats(
        startDate.toISOString(),
        endDate.toISOString(),
        { low: alarmThresholds.low, high: alarmThresholds.high }
      );
      setData(result);
    } catch (err) {
      setError('Falha ao carregar dados de distribuição.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [periodDays, alarmThresholds.low, alarmThresholds.high]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived: chart data with normal curve overlay ─────────────────────────
  const { chartData, chartMean, chartStdDev } = useMemo(() => {
    if (!data?.histogram?.length) return { chartData: [], chartMean: 0, chartStdDev: 0 };

    const total = data.histogram.reduce((s, b) => s + b.count, 0);
    if (total === 0) return { chartData: [], chartMean: 0, chartStdDev: 0 };

    const mu    = data.histogram.reduce((s, b) => s + (b.bin + 5) * b.count, 0) / total;
    const sigma = Math.sqrt(
      data.histogram.reduce((s, b) => s + Math.pow(b.bin + 5 - mu, 2) * b.count, 0) / total
    );

    const cd = data.histogram.map((b) => {
      const center = b.bin + 5;
      const normal = sigma > 0
        ? (10 / (sigma * Math.sqrt(2 * Math.PI))) *
          Math.exp(-Math.pow(center - mu, 2) / (2 * sigma * sigma)) * 100
        : 0;
      return {
        bin:     b.bin,
        percent: b.percent,
        normal:  Math.round(normal * 100) / 100,
        color:   binZoneColor(b.bin, alarmThresholds),
      };
    });

    return { chartData: cd, chartMean: mu, chartStdDev: sigma };
  }, [data, alarmThresholds]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const ul = unitLabel(unit);

  return (
    <main className="container mx-auto px-4 py-4 max-w-5xl space-y-4">

      {/* Header */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart className="h-4 w-4 text-primary" />
              Distribuição Glicêmica
            </CardTitle>
            <div className="flex gap-1">
              {PERIODS.map(({ label, days }) => (
                <Button
                  key={days}
                  variant={periodDays === days ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPeriodDays(days)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          {data && !loading && (
            <p className="text-xs text-muted-foreground mt-1">
              {data.totalReadings.toLocaleString('pt-BR')} leituras
              · Média {formatGlucose(chartMean, unit)} {ul}
              · DP {formatGlucose(chartStdDev, unit)} {ul}
            </p>
          )}
        </CardHeader>
      </Card>

      {/* Histogram */}
      <Card>
        <CardHeader className="pb-1 pt-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Histograma + Curva Normal Teórica
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-4">
          {loading && (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              Carregando…
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-48 text-destructive text-sm">
              {error}
            </div>
          )}
          {!loading && !error && chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="bin"
                  type="category"
                  interval={4}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  label={{ value: 'mg/dL', position: 'insideBottomRight', offset: -4, fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconSize={10}
                  wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }}
                />

                {/* Zone reference lines */}
                <ReferenceLine
                  x={alarmThresholds.low}
                  stroke="#f97316"
                  strokeDasharray="4 2"
                  strokeWidth={1.5}
                />
                <ReferenceLine
                  x={alarmThresholds.high}
                  stroke="#f59e0b"
                  strokeDasharray="4 2"
                  strokeWidth={1.5}
                />

                <Bar dataKey="percent" name="Leituras" maxBarSize={24} radius={[2, 2, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} fillOpacity={0.8} />
                  ))}
                </Bar>

                <Line
                  dataKey="normal"
                  name="Curva Normal"
                  type="monotone"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={1.5}
                  dot={false}
                  strokeDasharray="4 2"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
          {!loading && !error && chartData.length === 0 && (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              Sem dados para o período selecionado.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      {data && !loading && data.totalReadings > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            title="GVI"
            value={data.gvi.toFixed(2)}
            description="Índice de Variabilidade Glicêmica. Ideal < 1,2"
            quality={gviQuality(data.gvi)}
          />
          <MetricCard
            title="PGS"
            value={data.pgs.toFixed(1)}
            description="Patient Glycemic Status = GVI × % fora do alvo"
          />
          <MetricCard
            title="J-Index"
            value={data.jIndex.toFixed(1)}
            description="Qualidade do controle glicêmico. Ideal < 20"
            quality={jQuality(data.jIndex)}
          />
          <MetricCard
            title="IQR"
            value={formatGlucose(data.iqr, unit)}
            unit={ul}
            description="Amplitude interquartil (P75 − P25)"
          />
          <MetricCard
            title="Δ Diário"
            value={formatGlucose(data.meanDailyChange, unit)}
            unit={ul}
            description="Variação média entre médias diárias consecutivas"
          />
          <MetricCard
            title="RMS fora do alvo"
            value={formatGlucose(data.outOfRangeRms, unit)}
            unit={ul}
            description="Distância quadrática média até o limite mais próximo"
          />
          <MetricCard
            title="Flutuação"
            value={`${data.timeInFluctuation.toFixed(1)}%`}
            description="Intervalos com |Δg/Δt| > 1 mg/dL/min"
            quality={tifQuality(data.timeInFluctuation)}
          />
          <MetricCard
            title="Flutuação Rápida"
            value={`${data.timeInRapidFluctuation.toFixed(1)}%`}
            description="Intervalos com |Δg/Δt| > 2 mg/dL/min"
            quality={tifQuality(data.timeInRapidFluctuation)}
          />
        </div>
      )}
    </main>
  );
}
