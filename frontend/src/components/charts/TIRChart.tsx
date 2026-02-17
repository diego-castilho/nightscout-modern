// ============================================================================
// TIRChart - Time in Range: stacked bar + international targets table
// ============================================================================

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { toDisplayUnit, unitLabel } from '../../lib/glucose';
import { useDashboardStore } from '../../stores/dashboardStore';
import type { TimeInRange } from '../../lib/api';

interface Props {
  tir: TimeInRange | null;
  loading: boolean;
  totalReadings?: number;
  periodDays?: number; // used to compute time/day (default 1 = 24h)
}

interface RangeRow {
  label: string;
  range: string;           // template with {ul} placeholder
  thresholdLow?: number;   // mg/dL
  thresholdHigh?: number;  // mg/dL
  targetLabel: string;
  targetPct: number;
  targetOp: '>=' | '<=';
  color: string;
  bgColor: string;
  textColor: string;
  percentKey: keyof TimeInRange;
  countKey: keyof TimeInRange;
}

const THRESHOLDS = { veryLow: 54, low: 70, high: 180, veryHigh: 250 };

function buildRanges(t: typeof THRESHOLDS): RangeRow[] {
  return [
    {
      label: 'Muito Alto',
      range: `>${t.veryHigh}`,
      thresholdLow: t.veryHigh,
      targetLabel: 'Menor que 5%',
      targetPct: 5,
      targetOp: '<=',
      color: '#dc2626',
      bgColor: 'bg-red-600',
      textColor: 'text-red-600 dark:text-red-400',
      percentKey: 'percentVeryHigh',
      countKey: 'veryHigh',
    },
    {
      label: 'Alto',
      range: `${t.high}–${t.veryHigh}`,
      thresholdLow: t.high, thresholdHigh: t.veryHigh,
      targetLabel: 'Menor que 25%',
      targetPct: 25,
      targetOp: '<=',
      color: '#f59e0b',
      bgColor: 'bg-amber-500',
      textColor: 'text-amber-500 dark:text-amber-400',
      percentKey: 'percentHigh',
      countKey: 'high',
    },
    {
      label: 'Alvo',
      range: `${t.low}–${t.high}`,
      thresholdLow: t.low, thresholdHigh: t.high,
      targetLabel: 'Maior que 70%',
      targetPct: 70,
      targetOp: '>=',
      color: '#22c55e',
      bgColor: 'bg-green-500',
      textColor: 'text-green-600 dark:text-green-400',
      percentKey: 'percentInRange',
      countKey: 'inRange',
    },
    {
      label: 'Baixo',
      range: `${t.veryLow}–${t.low}`,
      thresholdLow: t.veryLow, thresholdHigh: t.low,
      targetLabel: 'Menor que 4%',
      targetPct: 4,
      targetOp: '<=',
      color: '#f97316',
      bgColor: 'bg-orange-500',
      textColor: 'text-orange-500 dark:text-orange-400',
      percentKey: 'percentLow',
      countKey: 'low',
    },
    {
      label: 'Muito Baixo',
      range: `<${t.veryLow}`,
      thresholdHigh: t.veryLow,
      targetLabel: 'Menor que 1%',
      targetPct: 1,
      targetOp: '<=',
      color: '#dc2626',
      bgColor: 'bg-red-700',
      textColor: 'text-red-700 dark:text-red-400',
      percentKey: 'percentVeryLow',
      countKey: 'veryLow',
    },
  ];
}

function pctToTime(pct: number): string {
  const totalMinutes = Math.round((pct / 100) * 24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins}min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}

function isTargetMet(pct: number, targetPct: number, op: '>=' | '<='): boolean {
  return op === '>=' ? pct >= targetPct : pct <= targetPct;
}

function rangeLabel(seg: RangeRow, ul: string): string {
  const fmt = (v: number, u: typeof ul) =>
    u === 'mmol/L' ? toDisplayUnit(v, 'mmol').toString() : v.toString();
  if (seg.thresholdLow && seg.thresholdHigh)
    return `${fmt(seg.thresholdLow, ul)}–${fmt(seg.thresholdHigh, ul)} ${ul}`;
  if (seg.thresholdLow)
    return `>${fmt(seg.thresholdLow, ul)} ${ul}`;
  if (seg.thresholdHigh)
    return `<${fmt(seg.thresholdHigh, ul)} ${ul}`;
  return `${seg.range} ${ul}`;
}

export function TIRChart({ tir, loading, totalReadings }: Props) {
  const { unit } = useDashboardStore();
  const ul = unitLabel(unit);
  const RANGES = buildRanges(THRESHOLDS);
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tempo no Alvo (TIR)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 bg-muted animate-pulse rounded-md" />
        </CardContent>
      </Card>
    );
  }

  if (!tir) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tempo no Alvo (TIR)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">Sem dados</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Tempo no Alvo (TIR)</span>
          {totalReadings && (
            <span className="text-xs font-normal text-muted-foreground">
              {totalReadings} leituras
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">

        {/* Stacked bar — order: veryHigh at left → veryLow at right */}
        <div className="flex h-8 rounded-lg overflow-hidden mb-4">
          {RANGES.map((seg) => {
            const pct = tir[seg.percentKey] as number;
            if (pct < 0.5) return null;
            return (
              <div
                key={seg.label}
                style={{ width: `${pct}%`, backgroundColor: seg.color }}
                className="flex items-center justify-center transition-all"
                title={`${seg.label}: ${pct.toFixed(1)}%`}
              >
                {pct >= 6 && (
                  <span className="text-white text-[10px] font-bold drop-shadow">
                    {pct.toFixed(0)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* International targets table */}
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left font-medium pb-1 pr-2">Faixa</th>
              <th className="text-right font-medium pb-1 pr-2 whitespace-nowrap">Meta (tempo/dia)</th>
              <th className="text-right font-medium pb-1 pr-2 whitespace-nowrap">Real</th>
              <th className="text-right font-medium pb-1 whitespace-nowrap">Tempo/dia</th>
            </tr>
          </thead>
          <tbody>
            {RANGES.map((seg) => {
              const actualPct = tir[seg.percentKey] as number;
              const met = isTargetMet(actualPct, seg.targetPct, seg.targetOp);
              const actualTime = pctToTime(actualPct);
              const targetTime = pctToTime(seg.targetPct);
              const metClass = met
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-500 dark:text-red-400';

              return (
                <tr key={seg.label} className="border-b border-border/30 last:border-0">
                  <td className="py-1 pr-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: seg.color }} />
                      <span className="font-medium whitespace-nowrap">{rangeLabel(seg, ul)}</span>
                    </div>
                  </td>
                  <td className="py-1 pr-2 text-right text-muted-foreground whitespace-nowrap">
                    {seg.targetOp === '>=' ? '>' : '<'}{seg.targetPct}% ({targetTime})
                  </td>
                  <td className={`py-1 pr-2 text-right font-bold whitespace-nowrap ${metClass}`}>
                    {actualPct.toFixed(1)}%
                  </td>
                  <td className={`py-1 text-right whitespace-nowrap ${metClass}`}>
                    {actualTime} {met ? '✓' : '✗'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
