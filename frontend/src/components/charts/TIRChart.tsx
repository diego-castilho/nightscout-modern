// ============================================================================
// TIRChart - Time in Range horizontal stacked bar
// ============================================================================

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { TimeInRange } from '../../lib/api';

interface Props {
  tir: TimeInRange | null;
  loading: boolean;
  totalReadings?: number;
}

interface Segment {
  key: keyof TimeInRange;
  percentKey: keyof TimeInRange;
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
  target: string;
  targetMet: (pct: number) => boolean;
}

const SEGMENTS: Segment[] = [
  {
    key: 'veryLow',
    percentKey: 'percentVeryLow',
    label: 'Muito Baixo',
    shortLabel: '<54',
    color: '#dc2626',
    bgColor: 'bg-red-600',
    target: '<1%',
    targetMet: (pct) => pct < 1,
  },
  {
    key: 'low',
    percentKey: 'percentLow',
    label: 'Baixo',
    shortLabel: '54-70',
    color: '#f97316',
    bgColor: 'bg-orange-500',
    target: '<4%',
    targetMet: (pct) => pct < 4,
  },
  {
    key: 'inRange',
    percentKey: 'percentInRange',
    label: 'No Alvo',
    shortLabel: '70-180',
    color: '#22c55e',
    bgColor: 'bg-green-500',
    target: '>70%',
    targetMet: (pct) => pct >= 70,
  },
  {
    key: 'high',
    percentKey: 'percentHigh',
    label: 'Alto',
    shortLabel: '180-250',
    color: '#f59e0b',
    bgColor: 'bg-amber-500',
    target: '<25%',
    targetMet: (pct) => pct < 25,
  },
  {
    key: 'veryHigh',
    percentKey: 'percentVeryHigh',
    label: 'Muito Alto',
    shortLabel: '>250',
    color: '#dc2626',
    bgColor: 'bg-red-600',
    target: '<5%',
    targetMet: (pct) => pct < 5,
  },
];

export function TIRChart({ tir, loading, totalReadings }: Props) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tempo no Alvo (TIR)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 bg-muted animate-pulse rounded-md" />
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
        {/* Stacked bar */}
        <div className="flex h-10 rounded-lg overflow-hidden mb-3">
          {SEGMENTS.map((seg) => {
            const pct = tir[seg.percentKey] as number;
            if (pct < 0.5) return null;
            return (
              <div
                key={seg.key}
                style={{ width: `${pct}%`, backgroundColor: seg.color }}
                className="flex items-center justify-center transition-all"
                title={`${seg.label}: ${pct.toFixed(1)}%`}
              >
                {pct >= 5 && (
                  <span className="text-white text-xs font-bold drop-shadow">
                    {pct.toFixed(0)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-5 gap-1">
          {SEGMENTS.map((seg) => {
            const pct = tir[seg.percentKey] as number;
            const count = tir[seg.key] as number;
            return (
              <div key={seg.key} className="text-center">
                <div
                  className="w-3 h-3 rounded-sm mx-auto mb-1"
                  style={{ backgroundColor: seg.color }}
                />
                <p className="text-[10px] text-muted-foreground leading-tight">{seg.shortLabel}</p>
                <p className="text-xs font-bold" style={{ color: seg.color }}>
                  {pct.toFixed(1)}%
                </p>
                <p className="text-[10px] text-muted-foreground">{count}</p>
              </div>
            );
          })}
        </div>

        {/* Targets */}
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2 font-medium">Metas internacionais:</p>
          <div className="flex flex-wrap gap-2">
            {SEGMENTS.map((seg) => {
              const pct = tir[seg.percentKey] as number;
              const met = seg.targetMet(pct);
              return (
                <span
                  key={seg.key}
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    met
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}
                >
                  {met ? '✓' : '✗'} {seg.shortLabel}: {seg.target}
                </span>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
