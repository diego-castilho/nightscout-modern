// ============================================================================
// DailyPatternChart - AGP-style 24h pattern with percentile bands
// Always fetches and shows the last 24h, independent of the selected period.
// X axis: continuous time from "now - 24h" → "now"
//   e.g. if it's 14:00 → shows 15:00 (yesterday) … 0:00 … 13:00 … 14:00 (now)
// When period ≤ 12h, hours before the selected window are dimmed.
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
  ReferenceArea,
  ResponsiveContainer,
  Label,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { getAnalytics } from '../../lib/api';
import type { DailyPattern } from '../../lib/api';
import { useDashboardStore, getPeriodDates, type Period } from '../../stores/dashboardStore';

// Periods that keep the original AGP behaviour (selected-period data, 00:00–23:00 axis)
const LONG_PERIODS: Period[] = ['7d', '14d', '30d'];

// Period → hours in the active selection window for the 24h-timeline mode
const PERIOD_HOURS: Partial<Record<Period, number>> = {
  '1h': 1, '3h': 3, '6h': 6, '12h': 12,
};

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
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-xs min-w-[150px]">
      <p className="font-semibold text-sm mb-1.5">{d.hour}</p>
      <div className="space-y-0.5">
        <p>
          <span className="text-muted-foreground">Mediana: </span>
          <span className="font-bold text-green-600 dark:text-green-400">{d.avg} mg/dL</span>
        </p>
        <p><span className="text-muted-foreground">P25–P75: </span>{d.p25}–{d.p75} mg/dL</p>
        <p><span className="text-muted-foreground">P5–P95: </span>{d.p5}–{d.p95} mg/dL</p>
        <p className="text-muted-foreground">{d.count} leituras</p>
      </div>
    </div>
  );
}

export function DailyPatternChart() {
  const { period, lastRefresh, alarmThresholds } = useDashboardStore();
  const yTicks = [0, alarmThresholds.veryLow, alarmThresholds.low, alarmThresholds.high, alarmThresholds.veryHigh, 350];
  const [patterns, setPatterns] = useState<DailyPattern[]>([]);
  const [loading, setLoading] = useState(true);

  const isLongPeriod = LONG_PERIODS.includes(period);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    // Long periods (7d/14d/30d): use the selected period for richer AGP patterns.
    // Short periods (≤ 24h): always fetch the last 24h for the timeline view.
    const { startDate, endDate } = isLongPeriod
      ? getPeriodDates(period)
      : { endDate: new Date().toISOString(), startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() };

    getAnalytics(startDate, endDate)
      .then((data) => {
        if (!cancelled) {
          setPatterns(data?.dailyPatterns ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPatterns([]);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [period, lastRefresh]);

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

  const currentHour = new Date().getHours();

  // Build raw data sorted 0–23
  const rawData: ChartPoint[] = patterns
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

  // ── Long periods (7d/14d/30d): classic AGP layout 00:00 → 23:00 ────────
  // ── Short periods (≤ 24h):     timeline layout (currentHour+1) → currentHour ─
  const data: ChartPoint[] = isLongPeriod
    ? rawData
    : [
        ...rawData.filter((d) => d.hourNum > currentHour),
        ...rawData.filter((d) => d.hourNum <= currentHour),
      ];

  const xTicks = isLongPeriod
    ? data.filter((d) => d.hourNum % 3 === 0).map((d) => d.hour)
    : data.filter((_, i) => i % 3 === 0).map((d) => d.hour);

  // Dimmed range only for short periods < 24h
  const periodHours = PERIOD_HOURS[period]; // undefined for 24h, 7d, 14d, 30d
  let dimRange: { x1: string; x2: string } | null = null;
  if (!isLongPeriod && periodHours !== undefined && data.length > periodHours) {
    const dimmEndIndex = data.length - periodHours - 1;
    if (dimmEndIndex >= 0) {
      dimRange = { x1: data[0].hour, x2: data[dimmEndIndex].hour };
    }
  }

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Padrão Diário (AGP)</span>
          {!isLongPeriod && (
            <span className="text-xs font-normal text-muted-foreground">últimas 24h</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={280}>
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
              width={35}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Target range lines */}
            <ReferenceLine y={alarmThresholds.high} stroke="#22c55e" strokeWidth={1.5}>
              <Label value={String(alarmThresholds.high)} position="right" fontSize={10} fill="#22c55e" offset={4} />
            </ReferenceLine>
            <ReferenceLine y={alarmThresholds.low} stroke="#22c55e" strokeWidth={1.5}>
              <Label value={String(alarmThresholds.low)} position="right" fontSize={10} fill="#22c55e" offset={4} />
            </ReferenceLine>
            <ReferenceLine y={alarmThresholds.veryLow} stroke="#f97316" strokeDasharray="3 3" strokeWidth={1}>
              <Label value={String(alarmThresholds.veryLow)} position="right" fontSize={10} fill="#f97316" offset={4} />
            </ReferenceLine>

            {/* ── Stacked percentile bands (bottom → top) ─────────────── */}
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

            {/* Dim hours that fall outside the selected period */}
            {dimRange && (
              <ReferenceArea
                x1={dimRange.x1}
                x2={dimRange.x2}
                fill="rgb(100,116,139)"
                fillOpacity={0.2}
                strokeOpacity={0}
                isFront={true}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex gap-4 mt-1 flex-wrap justify-end">
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-0.5 bg-green-700 dark:bg-green-500" />
            <span className="text-[10px] text-muted-foreground">Mediana (50%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded-sm" style={{ background: 'rgba(34,197,94,0.35)' }} />
            <span className="text-[10px] text-muted-foreground">P25–P75</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded-sm" style={{ background: 'rgba(34,197,94,0.15)' }} />
            <span className="text-[10px] text-muted-foreground">P5–P95</span>
          </div>
          {dimRange && (
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm" style={{ background: 'rgba(100,116,139,0.2)' }} />
              <span className="text-[10px] text-muted-foreground">Fora do período</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
