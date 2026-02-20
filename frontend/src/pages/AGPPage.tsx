// ============================================================================
// AGPPage — Ambulatory Glucose Profile (Relatório Imprimível) — Fase 7
// Referência: ATTD/ADA consensus 2019 AGP format
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, subDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Printer, FileText } from 'lucide-react';
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

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useDashboardStore } from '../stores/dashboardStore';
import { getAnalytics, getGlucoseRange } from '../lib/api';
import type { GlucoseAnalytics, GlucoseEntry } from '../lib/api';
import { formatGlucose, unitLabel } from '../lib/glucose';

// ============================================================================
// Constants
// ============================================================================

const PERIODS = [
  { label: '7 dias',  days: 7  },
  { label: '14 dias', days: 14 },
  { label: '30 dias', days: 30 },
];

const AGP_TICKS = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'];

// ============================================================================
// TIR Horizontal Bar
// ============================================================================

interface TIRBarProps {
  tir: GlucoseAnalytics['timeInRange'];
  thresholds: { veryLow: number; low: number; high: number; veryHigh: number };
  unit: 'mgdl' | 'mmol';
}

function TIRBar({ tir, thresholds, unit }: TIRBarProps) {
  const f = (v: number) => formatGlucose(v, unit);
  const zones = [
    { pct: tir.percentVeryLow,  label: `<${f(thresholds.veryLow)}`,                                       color: '#dc2626', name: 'Muito baixo' },
    { pct: tir.percentLow,      label: `${f(thresholds.veryLow)}–${f(thresholds.low)}`,                   color: '#f97316', name: 'Baixo'       },
    { pct: tir.percentInRange,  label: `${f(thresholds.low)}–${f(thresholds.high)}`,                      color: '#22c55e', name: 'No alvo'     },
    { pct: tir.percentHigh,     label: `${f(thresholds.high)}–${f(thresholds.veryHigh)}`,                 color: '#f59e0b', name: 'Alto'        },
    { pct: tir.percentVeryHigh, label: `>${f(thresholds.veryHigh)}`,                                      color: '#ef4444', name: 'Muito alto'  },
  ];

  return (
    <div className="space-y-2">
      <div className="flex h-8 rounded-md overflow-hidden">
        {zones.map((z, i) =>
          z.pct > 0 && (
            <div
              key={i}
              style={{ width: `${z.pct}%`, background: z.color }}
              title={`${z.name}: ${z.pct}%`}
            />
          )
        )}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
        {zones.map((z, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0" style={{ background: z.color }} />
            <span className="text-muted-foreground">{z.name} ({z.label})</span>
            <strong>{z.pct}%</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// AGP Chart — 24h profile with percentile bands
// Stacking trick: base area (transparent) + top area (colored) = band between two values
// ============================================================================

interface AGPChartProps {
  dailyPatterns: GlucoseAnalytics['dailyPatterns'];
  unit: 'mgdl' | 'mmol';
  thresholds: { veryLow: number; low: number; high: number; veryHigh: number };
}

function AGPChart({ dailyPatterns, unit, thresholds }: AGPChartProps) {
  const toD = (v: number) =>
    unit === 'mmol' ? Math.round((v / 18.018) * 10) / 10 : v;

  const data = dailyPatterns.map((dp) => ({
    label:      `${dp.hour.toString().padStart(2, '0')}:00`,
    // Outer band P5–P95 (stacking: base transparent + top colored = band from p5 to p95)
    outerBase:  toD(dp.p5    ?? 0),
    outerTop:   toD(Math.max(0, (dp.p95 ?? 0) - (dp.p5 ?? 0))),
    // IQR band P25–P75
    iqrBase:    toD(dp.p25   ?? 0),
    iqrTop:     toD(Math.max(0, (dp.p75 ?? 0) - (dp.p25 ?? 0))),
    // Median (P50)
    median:     toD(dp.median ?? 0),
    // Extra fields for tooltip (not rendered as chart elements)
    _p5:   toD(dp.p5   ?? 0),
    _p25:  toD(dp.p25  ?? 0),
    _p75:  toD(dp.p75  ?? 0),
    _p95:  toD(dp.p95  ?? 0),
  }));

  const yMin = toD(40);
  const yMax = toD(350);
  const u = unitLabel(unit);

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 8, right: 48, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            ticks={AGP_TICKS}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={(v) => (unit === 'mmol' ? Number(v).toFixed(1) : String(v))}
            width={38}
          />

          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]?.payload;
              if (!d) return null;
              return (
                <div className="bg-card border border-border rounded-md p-2 text-xs shadow-lg space-y-0.5">
                  <p className="font-semibold">{label}</p>
                  <p className="text-muted-foreground">P95: <span className="text-foreground">{d._p95} {u}</span></p>
                  <p className="text-muted-foreground">P75: <span className="text-foreground">{d._p75} {u}</span></p>
                  <p className="font-medium" style={{ color: '#2563eb' }}>Mediana: {d.median} {u}</p>
                  <p className="text-muted-foreground">P25: <span className="text-foreground">{d._p25} {u}</span></p>
                  <p className="text-muted-foreground">P5:  <span className="text-foreground">{d._p5} {u}</span></p>
                </div>
              );
            }}
          />

          {/* Reference lines */}
          <ReferenceLine
            y={toD(thresholds.veryLow)}
            stroke="#dc2626" strokeDasharray="3 2" strokeWidth={1}
            label={{ value: String(toD(thresholds.veryLow)), position: 'right', fontSize: 10, fill: '#dc2626' }}
          />
          <ReferenceLine
            y={toD(thresholds.low)}
            stroke="#f97316" strokeDasharray="4 2" strokeWidth={1.5}
            label={{ value: String(toD(thresholds.low)), position: 'right', fontSize: 10, fill: '#f97316' }}
          />
          <ReferenceLine
            y={toD(thresholds.high)}
            stroke="#16a34a" strokeDasharray="4 2" strokeWidth={1.5}
            label={{ value: String(toD(thresholds.high)), position: 'right', fontSize: 10, fill: '#16a34a' }}
          />
          <ReferenceLine
            y={toD(thresholds.veryHigh)}
            stroke="#dc2626" strokeDasharray="3 2" strokeWidth={1}
            label={{ value: String(toD(thresholds.veryHigh)), position: 'right', fontSize: 10, fill: '#dc2626' }}
          />

          {/* P5–P95 outer band */}
          <Area type="monotone" dataKey="outerBase" stackId="outer"
            fill="transparent" stroke="none" legendType="none" isAnimationActive={false} />
          <Area type="monotone" dataKey="outerTop" stackId="outer"
            fill="rgba(59,130,246,0.12)" stroke="rgba(59,130,246,0.28)" strokeWidth={1}
            legendType="none" isAnimationActive={false} />

          {/* P25–P75 IQR band */}
          <Area type="monotone" dataKey="iqrBase" stackId="iqr"
            fill="transparent" stroke="none" legendType="none" isAnimationActive={false} />
          <Area type="monotone" dataKey="iqrTop" stackId="iqr"
            fill="rgba(59,130,246,0.30)" stroke="rgba(59,130,246,0.50)" strokeWidth={1}
            legendType="none" isAnimationActive={false} />

          {/* Median */}
          <Line type="monotone" dataKey="median" stroke="#2563eb" strokeWidth={2.5}
            dot={false} legendType="none" isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Custom legend */}
      <div className="flex flex-wrap gap-5 text-xs text-muted-foreground justify-center">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-8 h-3 rounded"
            style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.28)' }} />
          P5–P95 (90% das leituras)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-8 h-3 rounded"
            style={{ background: 'rgba(59,130,246,0.30)', border: '1px solid rgba(59,130,246,0.50)' }} />
          P25–P75 (50% — IQR)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-8 border-t-[2.5px] border-blue-600 dark:border-blue-400 mt-1.5" />
          Mediana (P50)
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Day Mini Chart — SVG, lightweight and print-safe
// ============================================================================

interface DayMiniChartProps {
  date: Date;
  entries: GlucoseEntry[];
  low: number;
  high: number;
  unit: 'mgdl' | 'mmol';
}

function DayMiniChart({ date, entries, low, high, unit }: DayMiniChartProps) {
  const W = 118, H = 54;
  const YMIN = 40, YMAX = 350;

  const toX = (ts: number) => {
    const min = new Date(ts).getHours() * 60 + new Date(ts).getMinutes();
    return (min / 1440) * W;
  };
  const toY = (sgv: number) =>
    H - ((Math.min(Math.max(sgv, YMIN), YMAX) - YMIN) / (YMAX - YMIN)) * H;

  const sorted  = [...entries].sort((a, b) => a.date - b.date);
  const points  = sorted.map((e) => `${toX(e.date).toFixed(1)},${toY(e.sgv).toFixed(1)}`).join(' ');
  const avg     = entries.length > 0
    ? entries.reduce((s, e) => s + e.sgv, 0) / entries.length
    : null;

  let lineColor = '#22c55e';
  if (entries.some((e) => e.sgv < 54))     lineColor = '#dc2626';
  else if (entries.some((e) => e.sgv < low)) lineColor = '#f97316';
  else if (avg !== null && avg > high)       lineColor = '#f59e0b';

  const lowY  = toY(low);
  const highY = toY(high);

  return (
    <div className="flex flex-col items-center border rounded bg-card p-1 gap-0.5">
      <p className="text-[10px] font-medium leading-tight">
        {format(date, 'EEE', { locale: ptBR })}
      </p>
      <p className="text-[9px] text-muted-foreground leading-tight">
        {format(date, 'dd/MM')}
      </p>

      {entries.length === 0 ? (
        <div style={{ width: W, height: H }} className="flex items-center justify-center">
          <span className="text-[9px] text-muted-foreground">sem dados</span>
        </div>
      ) : (
        <svg width={W} height={H}>
          {/* Target zone background */}
          <rect x={0} y={highY} width={W} height={lowY - highY}
            fill="rgba(34,197,94,0.06)" />
          {/* Reference lines */}
          <line x1={0} y1={highY} x2={W} y2={highY}
            stroke="#16a34a" strokeWidth={0.7} strokeDasharray="3,2" opacity={0.7} />
          <line x1={0} y1={lowY} x2={W} y2={lowY}
            stroke="#f97316" strokeWidth={0.7} strokeDasharray="3,2" opacity={0.7} />
          {/* Glucose trace */}
          {points && (
            <polyline
              points={points}
              fill="none"
              stroke={lineColor}
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          )}
        </svg>
      )}

      {avg !== null && (
        <p className="text-[9px] text-muted-foreground">
          {formatGlucose(avg, unit)}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export function AGPPage() {
  const { unit, alarmThresholds, patientName } = useDashboardStore();

  const thresholds = {
    veryLow:  alarmThresholds?.veryLow  ?? 54,
    low:      alarmThresholds?.low      ?? 70,
    high:     alarmThresholds?.high     ?? 180,
    veryHigh: alarmThresholds?.veryHigh ?? 250,
  };

  const [periodDays, setPeriodDays] = useState(14);
  const [analytics, setAnalytics]   = useState<GlucoseAnalytics | null>(null);
  const [rawEntries, setRawEntries] = useState<GlucoseEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const { veryLow, low, high, veryHigh } = thresholds;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const end   = new Date();
      const start = subDays(end, periodDays);
      const [ana, entries] = await Promise.all([
        getAnalytics(start.toISOString(), end.toISOString(), { veryLow, low, high, veryHigh }),
        getGlucoseRange(start.toISOString(), end.toISOString()),
      ]);
      setAnalytics(ana);
      setRawEntries(entries);
    } catch (err) {
      setError('Erro ao carregar dados para o relatório AGP.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [periodDays, veryLow, low, high, veryHigh]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Group entries by local date string
  const entriesByDay = useMemo(() => {
    const map = new Map<string, GlucoseEntry[]>();
    for (const e of rawEntries) {
      const key = format(new Date(e.date), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [rawEntries]);

  // Build ordered array of days for the daily profiles grid
  const days = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: periodDays }, (_, i) =>
      subDays(today, periodDays - 1 - i)
    );
  }, [periodDays]);

  const endDate   = new Date();
  const startDate = subDays(endDate, periodDays);

  const stats = analytics?.stats;
  const tir   = analytics?.timeInRange;

  return (
    <>
      {/* Print CSS */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0.8cm; }
          .agp-no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <main className="container mx-auto px-4 py-4 max-w-6xl space-y-4">

        {/* Controls — hidden on print */}
        <div className="agp-no-print flex flex-wrap items-center gap-2">
          <FileText className="h-5 w-5 text-primary flex-shrink-0" />
          <span className="font-semibold">AGP — Perfil Glicêmico Ambulatorial</span>
          <div className="flex gap-1">
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
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => window.print()}
            disabled={loading || !!error}
          >
            <Printer className="h-4 w-4 mr-2" />
            Imprimir / PDF
          </Button>
        </div>

        {/* Loading */}
        {loading && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Carregando relatório AGP...
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {!loading && error && (
          <Card>
            <CardContent className="py-8 text-center text-destructive">{error}</CardContent>
          </Card>
        )}

        {/* Report */}
        {!loading && !error && analytics && stats && tir && (
          <div className="space-y-4">

            {/* ── Report header ── */}
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">
                      AGP — Perfil Glicêmico Ambulatorial
                    </CardTitle>
                    {patientName && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Paciente: {patientName}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-sm text-muted-foreground leading-relaxed">
                    <p>
                      {format(startDate, 'dd/MM/yyyy', { locale: ptBR })}
                      {' – '}
                      {format(endDate, 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                    <p>{periodDays} dias · {analytics.totalReadings} leituras</p>
                    <p>
                      Gerado em{' '}
                      {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* ── Statistics grid ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: 'GMI (est. HbA1c)',
                  value: `${stats.gmi}%`,
                  sub:   'Glucose Management Indicator',
                  good:  stats.gmi < 7,
                },
                {
                  label: 'Glicemia Média',
                  value: `${formatGlucose(stats.average, unit)} ${unitLabel(unit)}`,
                  sub:   'Média do período',
                  good:  stats.average >= low && stats.average <= high,
                },
                {
                  label: 'Coef. de Variação',
                  value: `${stats.cv}%`,
                  sub:   'Meta: ≤36%',
                  good:  stats.cv <= 36,
                },
                {
                  label: 'Tempo no Alvo',
                  value: `${tir.percentInRange}%`,
                  sub:   `Meta: ≥70% (${formatGlucose(low, unit)}–${formatGlucose(high, unit)})`,
                  good:  tir.percentInRange >= 70,
                },
              ].map((s, i) => (
                <Card key={i}>
                  <CardContent className="pt-4 text-center space-y-0.5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide leading-tight">
                      {s.label}
                    </p>
                    <p className={`text-2xl font-bold ${s.good
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-amber-500'}`}>
                      {s.value}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{s.sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* ── TIR bar ── */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Tempo no Intervalo (TIR)</CardTitle>
              </CardHeader>
              <CardContent>
                <TIRBar tir={tir} thresholds={thresholds} unit={unit} />
              </CardContent>
            </Card>

            {/* ── AGP Chart ── */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Perfil Glicêmico Ambulatorial — 24 horas
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    combinação de {periodDays} dias sobrepostos
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AGPChart
                  dailyPatterns={analytics.dailyPatterns}
                  unit={unit}
                  thresholds={thresholds}
                />
              </CardContent>
            </Card>

            {/* ── Daily Profiles grid ── */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Perfis Diários
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    Verde = no alvo · Laranja = baixo · Vermelho = hipo · Amarelo = alto
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1.5">
                  {days.map((day) => {
                    const key = format(day, 'yyyy-MM-dd');
                    return (
                      <DayMiniChart
                        key={key}
                        date={day}
                        entries={entriesByDay.get(key) ?? []}
                        low={low}
                        high={high}
                        unit={unit}
                      />
                    );
                  })}
                </div>
              </CardContent>
            </Card>

          </div>
        )}
      </main>
    </>
  );
}
