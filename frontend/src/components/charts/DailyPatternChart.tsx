// ============================================================================
// DailyPatternChart - 24h hourly pattern with percentile bands
// Always shows full 24h pattern regardless of selected period.
// Hours that haven't occurred yet today are shown in a lighter shade.
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
  hourNum: number;
  avg: number;
  p25: number;
  p75: number;
  p5: number;
  p95: number;
  count: number;
  isPast: boolean; // has this hour already happened today?
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0].payload;

  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm min-w-[160px]">
      <p className="font-semibold mb-2">{point.hour} {point.isPast ? '(hoje)' : '(histórico)'}</p>
      <div className="space-y-0.5 text-xs">
        <p className="text-green-500 font-bold">Média: {point.avg} mg/dL</p>
        <p className="text-blue-400">P75: {point.p75} · P25: {point.p25}</p>
        <p className="text-slate-400">P95: {point.p95} · P5: {point.p5}</p>
        <p className="text-muted-foreground">{point.count} leituras</p>
      </div>
    </div>
  );
}

// Legend item component
function LegendItem({ color, label, opacity = 1 }: { color: string; label: string; opacity?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color, opacity }} />
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

export function DailyPatternChart({ patterns, loading }: Props) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Padrão Diário (24h)</CardTitle>
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
          <CardTitle className="text-base">Padrão Diário (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Sem dados suficientes para o padrão diário
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentHour = new Date().getHours();

  const data: ChartPoint[] = patterns
    .sort((a, b) => a.hour - b.hour)
    .map((p) => ({
      hour: `${String(p.hour).padStart(2, '0')}h`,
      hourNum: p.hour,
      avg: p.averageGlucose,
      p25: p.p25 ?? Math.max(40, p.averageGlucose - Math.round(p.stdDev * 0.674)),
      p75: p.p75 ?? Math.min(400, p.averageGlucose + Math.round(p.stdDev * 0.674)),
      p5: p.p5 ?? Math.max(40, p.averageGlucose - Math.round(p.stdDev * 1.645)),
      p95: p.p95 ?? Math.min(400, p.averageGlucose + Math.round(p.stdDev * 1.645)),
      count: p.count,
      isPast: p.hour <= currentHour,
    }));

  const allValues = data.flatMap((d) => [d.p95, d.p5]).filter((v) => v > 0);
  const minVal = Math.max(40, Math.min(...allValues) - 10);
  const maxVal = Math.min(400, Math.max(...allValues) + 10);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Padrão Diário (24h)</span>
          <span className="text-xs font-normal text-muted-foreground">
            horas passadas / históricas
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              {/* IQR band (P25-P75) - today hours */}
              <linearGradient id="iqrBandToday" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0.15} />
              </linearGradient>
              {/* Wide band (P5-P95) - today hours */}
              <linearGradient id="wideBandToday" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0.04} />
              </linearGradient>
              {/* IQR band (P25-P75) - historical hours */}
              <linearGradient id="iqrBandHist" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.1} />
              </linearGradient>
              {/* Wide band (P5-P95) - historical hours */}
              <linearGradient id="wideBandHist" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.03} />
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

            <ReferenceLine y={180} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1} />
            <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1} />

            {/* Vertical line at current hour */}
            <ReferenceLine
              x={`${String(currentHour).padStart(2, '0')}h`}
              stroke="#6366f1"
              strokeDasharray="3 3"
              strokeWidth={1.5}
              label={{ value: 'agora', position: 'insideTopLeft', fontSize: 9, fill: '#6366f1' }}
            />

            {/* P5-P95 wide band */}
            <Area
              type="monotone"
              dataKey="p95"
              stroke="none"
              fill="url(#wideBandToday)"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="p5"
              stroke="none"
              fill="transparent"
              isAnimationActive={false}
            />

            {/* P25-P75 IQR band */}
            <Area
              type="monotone"
              dataKey="p75"
              stroke="none"
              fill="url(#iqrBandToday)"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="p25"
              stroke="none"
              fill="transparent"
              isAnimationActive={false}
            />

            {/* Average line - color varies by past/future */}
            <Line
              type="monotone"
              dataKey="avg"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={true}
              animationDuration={600}
              stroke="#22c55e"
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex gap-4 mt-2 flex-wrap">
          <LegendItem color="#22c55e" label="Média" />
          <LegendItem color="#22c55e" label="P25–P75 (50% das leituras)" opacity={0.4} />
          <LegendItem color="#22c55e" label="P5–P95 (90% das leituras)" opacity={0.2} />
          <LegendItem color="#6366f1" label="Hora atual" />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Horas antes de "{String(currentHour).padStart(2, '0')}h" = hoje · horas após = históricas dos dias anteriores
        </p>
      </CardContent>
    </Card>
  );
}
