// ============================================================================
// TIRChart - Time in Range: stacked bar + international targets table
// ============================================================================

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { TimeInRange } from '../../lib/api';

interface Props {
  tir: TimeInRange | null;
  loading: boolean;
  totalReadings?: number;
  periodDays?: number; // used to compute time/day (default 1 = 24h)
}

interface RangeRow {
  label: string;
  range: string;
  targetLabel: string;
  targetPct: number;
  targetOp: '>=' | '<=';
  color: string;
  bgColor: string;
  textColor: string;
  percentKey: keyof TimeInRange;
  countKey: keyof TimeInRange;
}

const RANGES: RangeRow[] = [
  {
    label: 'Muito Alto',
    range: '>250 mg/dL',
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
    range: '180–250 mg/dL',
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
    range: '70–180 mg/dL',
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
    range: '54–70 mg/dL',
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
    range: '<54 mg/dL',
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

export function TIRChart({ tir, loading, totalReadings }: Props) {
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
        <div className="text-xs">
          {/* Header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 gap-y-0 pb-1 mb-1 border-b border-border font-medium text-muted-foreground">
            <span>Faixa de Glicose</span>
            <span className="text-right">Meta</span>
            <span className="text-right">Real</span>
            <span className="text-right">Tempo/dia</span>
          </div>

          {/* Rows */}
          <div className="space-y-1">
            {RANGES.map((seg) => {
              const actualPct = tir[seg.percentKey] as number;
              const met = isTargetMet(actualPct, seg.targetPct, seg.targetOp);
              const actualTime = pctToTime(actualPct);
              const targetTime = pctToTime(seg.targetPct);

              return (
                <div
                  key={seg.label}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 items-center py-0.5"
                >
                  {/* Range label + color dot */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div
                      className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{seg.range}</p>
                    </div>
                  </div>

                  {/* Target */}
                  <span className="text-muted-foreground text-right whitespace-nowrap">
                    {seg.targetOp === '>=' ? '>' : '<'}{seg.targetPct}%
                    <br />
                    <span className="text-[10px]">({targetTime})</span>
                  </span>

                  {/* Actual % */}
                  <span className={`font-bold text-right whitespace-nowrap ${met ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                    {actualPct.toFixed(1)}%
                  </span>

                  {/* Actual time + met indicator */}
                  <span className={`text-right whitespace-nowrap ${met ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                    {actualTime}
                    <span className="ml-1">{met ? '✓' : '✗'}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
