// ============================================================================
// DailyPatternChart - AGP (Ambulatory Glucose Profile) clínico padrão
// Sempre exibe o eixo 00:00 → 23:00, independente do período selecionado.
// Períodos curtos (≤24h) usam as últimas 24h para calcular os padrões.
// Períodos longos (7d/14d/30d) usam o período selecionado para padrões mais ricos.
// Inclui estatísticas inline: Média, GMI, CV%, % no Alvo.
// ============================================================================

import { useState, useEffect } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Label,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { getAnalytics } from '../../lib/api';
import type { DailyPattern, GlucoseStats, TimeInRange } from '../../lib/api';
import { useDashboardStore, getPeriodDates, type Period } from '../../stores/dashboardStore';
import { formatGlucose, unitLabel } from '../../lib/glucose';

// Periods that use the selected date range (richer AGP patterns)
const LONG_PERIODS: Period[] = ['7d', '14d', '30d'];

interface ChartPoint {
  hour: string;       // "HH:00"
  hourNum: number;
  avg: number;
  p5_base: number;
  outer_low: number;
  inner: number;
  outer_high: number;
  p5: number;
  p25: number;
  p75: number;
  p95: number;
  count: number;
}

const pad = (h: number) => `${String(h).padStart(2, '0')}:00`;

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
  unit: import('../../lib/glucose').GlucoseUnit;
}

function CustomTooltip({ active, payload, unit }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  const ul = unitLabel(unit);
  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-xs min-w-[160px]">
      <p className="font-semibold text-sm mb-1.5">{d.hour}</p>
      <div className="space-y-0.5">
        <p>
          <span className="text-muted-foreground">Mediana: </span>
          <span className="font-bold text-green-600 dark:text-green-400">
            {formatGlucose(d.avg, unit)} {ul}
          </span>
        </p>
        <p>
          <span className="text-muted-foreground">P25–P75: </span>
          {formatGlucose(d.p25, unit)}–{formatGlucose(d.p75, unit)} {ul}
        </p>
        <p>
          <span className="text-muted-foreground">P5–P95: </span>
          {formatGlucose(d.p5, unit)}–{formatGlucose(d.p95, unit)} {ul}
        </p>
        <p className="text-muted-foreground pt-0.5">
          {d.count} leituras
          {d.count < 3 && <span className="text-amber-500 ml-1">(dados escassos)</span>}
        </p>
      </div>
    </div>
  );
}

export function DailyPatternChart() {
  const { period, lastRefresh, alarmThresholds, unit } = useDashboardStore();
  const yTicks = [0, alarmThresholds.veryLow, alarmThresholds.low, alarmThresholds.high, alarmThresholds.veryHigh, 350];

  const [patterns, setPatterns] = useState<DailyPattern[]>([]);
  const [stats, setStats]       = useState<GlucoseStats | null>(null);
  const [tir, setTir]           = useState<TimeInRange | null>(null);
  const [loading, setLoading]   = useState(true);

  const isLongPeriod = LONG_PERIODS.includes(period);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    // Long periods (7d/14d/30d): use selected period for richer AGP patterns.
    // Short periods (≤24h): always use the last 24h.
    const { startDate, endDate } = isLongPeriod
      ? getPeriodDates(period)
      : { endDate: new Date().toISOString(), startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() };

    getAnalytics(startDate, endDate, alarmThresholds)
      .then((data) => {
        if (!cancelled) {
          setPatterns(data?.dailyPatterns ?? []);
          setStats(data?.stats ?? null);
          setTir(data?.timeInRange ?? null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPatterns([]);
          setStats(null);
          setTir(null);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [period, lastRefresh, alarmThresholds]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Padrão Diário (AGP)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted animate-pulse rounded-md" />
        </CardContent>
      </Card>
    );
  }

  if (!patterns || patterns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Padrão Diário (AGP)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Sem dados suficientes
          </div>
        </CardContent>
      </Card>
    );
  }

  // Always 00:00 → 23:00 (classic AGP layout)
  const data: ChartPoint[] = patterns
    .sort((a, b) => a.hour - b.hour)
    .map((p) => {
      const p5  = p.p5  ?? Math.max(40,  p.averageGlucose - Math.round(p.stdDev * 1.645));
      const p25 = p.p25 ?? Math.max(p5,  p.averageGlucose - Math.round(p.stdDev * 0.674));
      const p75 = p.p75 ?? Math.min(400, p.averageGlucose + Math.round(p.stdDev * 0.674));
      const p95 = p.p95 ?? Math.min(400, p.averageGlucose + Math.round(p.stdDev * 1.645));
      return {
        hour:       pad(p.hour),
        hourNum:    p.hour,
        avg:        p.averageGlucose,
        p5_base:    Math.max(0, p5),
        outer_low:  Math.max(0, p25 - p5),
        inner:      Math.max(0, p75 - p25),
        outer_high: Math.max(0, p95 - p75),
        p5, p25, p75, p95,
        count: p.count,
      };
    });

  const xTicks = data.filter((d) => d.hourNum % 3 === 0).map((d) => d.hour);

  // Stat badge colors
  const gmiGood  = stats && stats.gmi  <= 7;
  const cvGood   = stats && stats.cv   <= 36;
  const tirGood  = tir  && tir.percentInRange >= 70;
  const good   = 'text-green-600 dark:text-green-400';
  const warn   = 'text-amber-500';

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Padrão Diário (AGP)</span>
          <span className="text-xs font-normal text-muted-foreground">
            {isLongPeriod ? `baseado nos últimos ${period}` : 'últimas 24h'}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0">
        {/* ── Inline statistics row ──────────────────────────────────── */}
        {stats && tir && (
          <div className="grid grid-cols-4 gap-1 mb-3 px-1">
            {/* Média */}
            <div className="text-center rounded-md bg-muted/50 py-1.5 px-1">
              <p className="text-[10px] text-muted-foreground leading-none mb-0.5">Média</p>
              <p className="text-sm font-bold leading-none">
                {formatGlucose(stats.average, unit)}
                <span className="text-[10px] font-normal text-muted-foreground ml-0.5">{unitLabel(unit)}</span>
              </p>
            </div>
            {/* GMI */}
            <div className="text-center rounded-md bg-muted/50 py-1.5 px-1">
              <p className="text-[10px] text-muted-foreground leading-none mb-0.5">GMI</p>
              <p className={`text-sm font-bold leading-none ${gmiGood ? good : warn}`}>
                {stats.gmi.toFixed(1)}
                <span className="text-[10px] font-normal ml-0.5">%</span>
              </p>
            </div>
            {/* CV% */}
            <div className="text-center rounded-md bg-muted/50 py-1.5 px-1">
              <p className="text-[10px] text-muted-foreground leading-none mb-0.5">CV%</p>
              <p className={`text-sm font-bold leading-none ${cvGood ? good : warn}`}>
                {stats.cv.toFixed(0)}
                <span className="text-[10px] font-normal ml-0.5">%</span>
              </p>
            </div>
            {/* No Alvo */}
            <div className="text-center rounded-md bg-muted/50 py-1.5 px-1">
              <p className="text-[10px] text-muted-foreground leading-none mb-0.5">No Alvo</p>
              <p className={`text-sm font-bold leading-none ${tirGood ? good : warn}`}>
                {tir.percentInRange.toFixed(0)}
                <span className="text-[10px] font-normal ml-0.5">%</span>
              </p>
            </div>
          </div>
        )}

        {/* ── Chart ─────────────────────────────────────────────────── */}
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 48, left: -10, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="currentColor"
              className="text-border"
              opacity={0.25}
              vertical={true}
              horizontal={false}
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

            <Tooltip content={<CustomTooltip unit={unit} />} />

            {/* Target range reference lines */}
            <ReferenceLine y={alarmThresholds.veryHigh} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1}>
              <Label value={formatGlucose(alarmThresholds.veryHigh, unit)} position="right" fontSize={10} fill="#f59e0b" offset={4} />
            </ReferenceLine>
            <ReferenceLine y={alarmThresholds.high} stroke="#22c55e" strokeWidth={1.5}>
              <Label value={formatGlucose(alarmThresholds.high, unit)} position="right" fontSize={10} fill="#22c55e" offset={4} />
            </ReferenceLine>
            <ReferenceLine y={alarmThresholds.low} stroke="#22c55e" strokeWidth={1.5}>
              <Label value={formatGlucose(alarmThresholds.low, unit)} position="right" fontSize={10} fill="#22c55e" offset={4} />
            </ReferenceLine>
            <ReferenceLine y={alarmThresholds.veryLow} stroke="#f97316" strokeDasharray="3 3" strokeWidth={1}>
              <Label value={formatGlucose(alarmThresholds.veryLow, unit)} position="right" fontSize={10} fill="#f97316" offset={4} />
            </ReferenceLine>

            {/* ── Stacked percentile bands (bottom → top) ────────────── */}
            <Area type="monotone" dataKey="p5_base"    stackId="bands" stroke="none" fill="transparent"           isAnimationActive={false} legendType="none" />
            <Area type="monotone" dataKey="outer_low"  stackId="bands" stroke="none" fill="rgba(34,197,94,0.15)"  isAnimationActive={false} legendType="none" />
            <Area type="monotone" dataKey="inner"      stackId="bands" stroke="none" fill="rgba(34,197,94,0.35)"  isAnimationActive={false} legendType="none" />
            <Area type="monotone" dataKey="outer_high" stackId="bands" stroke="none" fill="rgba(34,197,94,0.15)"  isAnimationActive={false} legendType="none" />

            {/* Median line */}
            <Line
              type="monotone"
              dataKey="avg"
              stroke="#16a34a"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: '#16a34a' }}
              isAnimationActive={true}
              animationDuration={600}
              legendType="none"
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex gap-4 mt-1 flex-wrap justify-end">
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-0.5 bg-green-700 dark:bg-green-500" />
            <span className="text-[10px] text-muted-foreground">Mediana (P50)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded-sm" style={{ background: 'rgba(34,197,94,0.35)' }} />
            <span className="text-[10px] text-muted-foreground">P25–P75</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded-sm" style={{ background: 'rgba(34,197,94,0.15)' }} />
            <span className="text-[10px] text-muted-foreground">P5–P95</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
