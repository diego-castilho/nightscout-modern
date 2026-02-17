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
import { useDashboardStore } from '../../stores/dashboardStore';
import { getTrendArrow } from '../../lib/utils';

interface Props {
  entries: GlucoseEntry[];
  loading: boolean;
}

interface ChartPoint {
  time: number;
  timeLabel: string;
  sgv: number;
  direction?: string;
  trend?: number;
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
  payload?: Array<{ value: number; payload: ChartPoint }>;
  label?: string;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0].payload;
  const sgv = point.sgv;
  const color = getGlucoseColor(sgv);
  const date = new Date(point.time);

  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="text-muted-foreground text-xs mb-1">
        {format(date, "dd/MM HH:mm", { locale: ptBR })}
      </p>
      <p className="font-bold text-base" style={{ color }}>
        {sgv} mg/dL {point.direction ? getTrendArrow(point.trend) : ''}
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

  const isShortPeriod = ['3h', '6h', '12h', '24h'].includes(period);

  const data: ChartPoint[] = [...entries]
    .sort((a, b) => a.date - b.date)
    .map((e) => ({
      time: e.date,
      timeLabel: format(new Date(e.date), isShortPeriod ? 'HH:mm' : 'dd/MM HH:mm', { locale: ptBR }),
      sgv: e.sgv,
      direction: e.direction,
      trend: e.trend,
    }));

  // Y axis domain with some padding
  const minVal = Math.max(0, Math.min(...data.map((d) => d.sgv)) - 20);
  const maxVal = Math.min(400, Math.max(...data.map((d) => d.sgv)) + 30);

  // Determine X tick count based on data length
  const tickCount = Math.min(8, data.length);

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
              dataKey="timeLabel"
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-muted-foreground"
              interval="preserveStartEnd"
              tickCount={tickCount}
            />

            <YAxis
              domain={[minVal, maxVal]}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-muted-foreground"
              tickFormatter={(v) => `${v}`}
              width={40}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Target range shading between 70 and 180 */}
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
              dot={data.length < 50 ? { r: 2, fill: '#22c55e' } : false}
              activeDot={{ r: 5, fill: '#22c55e', stroke: '#fff', strokeWidth: 2 }}
              isAnimationActive={true}
              animationDuration={800}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
