// ============================================================================
// GlucoseAreaChart - Interactive glucose readings over time
// ============================================================================

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
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { GlucoseEntry } from '../../lib/api';
import { useDashboardStore, type Period } from '../../stores/dashboardStore';
import { getTrendArrow } from '../../lib/utils';

interface Props {
  entries: GlucoseEntry[];
  loading: boolean;
}

interface ChartPoint {
  time: number;
  sgv: number;
  direction?: string;
  trend?: number;
}

// Returns explicit tick timestamps and format string based on period
function getTickConfig(period: Period, start: number, end: number): {
  ticks: number[];
  formatStr: string;
} {
  let intervalMs: number;
  let formatStr: string;

  switch (period) {
    case '1h':
      intervalMs = 5 * 60 * 1000;           // every 5 min
      formatStr = 'HH:mm';
      break;
    case '3h':
      intervalMs = 15 * 60 * 1000;          // every 15 min
      formatStr = 'HH:mm';
      break;
    case '6h':
      intervalMs = 30 * 60 * 1000;          // every 30 min
      formatStr = 'HH:mm';
      break;
    case '12h':
      intervalMs = 60 * 60 * 1000;          // every 1h
      formatStr = 'HH:mm';
      break;
    case '24h':
      intervalMs = 2 * 60 * 60 * 1000;      // every 2h
      formatStr = 'HH:mm';
      break;
    case '7d':
      intervalMs = 24 * 60 * 60 * 1000;     // every day
      formatStr = 'EEE dd/MM';
      break;
    case '14d':
      intervalMs = 2 * 24 * 60 * 60 * 1000; // every 2 days
      formatStr = 'dd/MM';
      break;
    case '30d':
      intervalMs = 5 * 24 * 60 * 60 * 1000; // every 5 days
      formatStr = 'dd/MM';
      break;
    default:
      intervalMs = 60 * 60 * 1000;
      formatStr = 'HH:mm';
  }

  // Generate ticks at exact interval boundaries
  const ticks: number[] = [];
  const firstTick = Math.ceil(start / intervalMs) * intervalMs;
  for (let t = firstTick; t <= end; t += intervalMs) {
    ticks.push(t);
  }

  return { ticks, formatStr };
}

function getGlucoseColor(sgv: number): string {
  if (sgv < 54) return '#dc2626';
  if (sgv < 70) return '#f59e0b';
  if (sgv <= 180) return '#22c55e';
  if (sgv <= 250) return '#f59e0b';
  return '#dc2626';
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0].payload;
  const color = getGlucoseColor(point.sgv);
  const date = new Date(point.time);

  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="text-muted-foreground text-xs mb-1">
        {format(date, 'dd/MM HH:mm', { locale: ptBR })}
      </p>
      <p className="font-bold text-base" style={{ color }}>
        {point.sgv} mg/dL {getTrendArrow(point.trend)}
      </p>
    </div>
  );
}

export function GlucoseAreaChart({ entries, loading }: Props) {
  const { period } = useDashboardStore();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leituras de Glicose</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted animate-pulse rounded-md" />
        </CardContent>
      </Card>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leituras de Glicose</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Sem dados para o período selecionado
          </div>
        </CardContent>
      </Card>
    );
  }

  const data: ChartPoint[] = [...entries]
    .sort((a, b) => a.date - b.date)
    .map((e) => ({
      time: e.date,
      sgv: e.sgv,
      direction: e.direction,
      trend: e.trend,
    }));

  const startTime = data[0].time;
  const endTime = data[data.length - 1].time;

  const { ticks, formatStr } = getTickConfig(period, startTime, endTime);

  const minVal = Math.max(0, Math.min(...data.map((d) => d.sgv)) - 20);
  const maxVal = Math.min(400, Math.max(...data.map((d) => d.sgv)) + 30);

  // Show individual dots only for very short periods (1h = ~12 points)
  const showDots = data.length <= 20;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Leituras de Glicose</span>
          <span className="text-xs font-normal text-muted-foreground">
            {entries.length} leituras
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="glucoseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#dc2626" stopOpacity={0.8} />
                <stop offset="15%" stopColor="#f59e0b" stopOpacity={0.7} />
                <stop offset="30%" stopColor="#22c55e" stopOpacity={0.6} />
                <stop offset="70%" stopColor="#22c55e" stopOpacity={0.6} />
                <stop offset="85%" stopColor="#f59e0b" stopOpacity={0.7} />
                <stop offset="100%" stopColor="#dc2626" stopOpacity={0.8} />
              </linearGradient>
              <linearGradient id="glucoseAreaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="currentColor"
              className="text-border"
              opacity={0.3}
            />

            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              ticks={ticks}
              tickFormatter={(ms: number) => format(new Date(ms), formatStr, { locale: ptBR })}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-muted-foreground"
            />

            <YAxis
              domain={[minVal, maxVal]}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-muted-foreground"
              width={40}
            />

            <Tooltip content={<CustomTooltip />} />

            <ReferenceLine
              y={180}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{ value: '180', position: 'insideTopRight', fontSize: 10, fill: '#f59e0b' }}
            />
            <ReferenceLine
              y={70}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{ value: '70', position: 'insideBottomRight', fontSize: 10, fill: '#f59e0b' }}
            />
            <ReferenceLine
              y={54}
              stroke="#dc2626"
              strokeDasharray="2 4"
              strokeWidth={1}
            />

            <Area
              type="monotone"
              dataKey="sgv"
              stroke="url(#glucoseGradient)"
              strokeWidth={2}
              fill="url(#glucoseAreaFill)"
              dot={showDots ? { r: 2.5, fill: '#22c55e', strokeWidth: 0 } : false}
              activeDot={{ r: 5, fill: '#22c55e', stroke: '#fff', strokeWidth: 2 }}
              isAnimationActive={true}
              animationDuration={600}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
