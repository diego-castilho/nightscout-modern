// ============================================================================
// DailyPatternChart - Hourly glucose average with stdDev band
// ============================================================================

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
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { DailyPattern } from '../../lib/api';

interface Props {
  patterns: DailyPattern[];
  loading: boolean;
}

interface ChartPoint {
  hour: string;
  avg: number;
  upper: number;
  lower: number;
  count: number;
  stdDev: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: ChartPoint }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0].payload;

  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium mb-1">{point.hour}</p>
      <p className="text-green-500 font-bold">Média: {point.avg.toFixed(0)} mg/dL</p>
      <p className="text-muted-foreground text-xs">±{point.stdDev.toFixed(0)} (desvio padrão)</p>
      <p className="text-muted-foreground text-xs">{point.count} leituras</p>
    </div>
  );
}

export function DailyPatternChart({ patterns, loading }: Props) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Padrão Diário (por hora)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 bg-muted animate-pulse rounded-md" />
        </CardContent>
      </Card>
    );
  }

  if (!patterns || patterns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Padrão Diário (por hora)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center text-muted-foreground">
            Sem dados para o período selecionado
          </div>
        </CardContent>
      </Card>
    );
  }

  const data: ChartPoint[] = patterns
    .sort((a, b) => a.hour - b.hour)
    .map((p) => ({
      hour: `${String(p.hour).padStart(2, '0')}h`,
      avg: p.averageGlucose,
      upper: Math.min(400, p.averageGlucose + p.stdDev),
      lower: Math.max(40, p.averageGlucose - p.stdDev),
      count: p.count,
      stdDev: p.stdDev,
    }));

  const allValues = data.flatMap((d) => [d.upper, d.lower]);
  const minVal = Math.max(40, Math.min(...allValues) - 10);
  const maxVal = Math.min(400, Math.max(...allValues) + 10);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Padrão Diário (por hora)</span>
          <span className="text-xs font-normal text-muted-foreground">
            média ± desvio padrão
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="stdDevBand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="currentColor"
              className="text-border"
              opacity={0.3}
            />

            <XAxis
              dataKey="hour"
              tick={{ fontSize: 10, fill: 'currentColor' }}
              className="text-muted-foreground"
              interval={2}
            />

            <YAxis
              domain={[minVal, maxVal]}
              tick={{ fontSize: 10, fill: 'currentColor' }}
              className="text-muted-foreground"
              width={35}
            />

            <Tooltip content={<CustomTooltip />} />

            <ReferenceLine
              y={180}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <ReferenceLine
              y={70}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeWidth={1}
            />

            {/* StdDev band */}
            <Area
              type="monotone"
              dataKey="upper"
              stroke="none"
              fill="url(#stdDevBand)"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="lower"
              stroke="none"
              fill="transparent"
              isAnimationActive={false}
            />

            {/* Average line */}
            <Line
              type="monotone"
              dataKey="avg"
              stroke="#22c55e"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: '#22c55e' }}
              isAnimationActive={true}
              animationDuration={800}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
