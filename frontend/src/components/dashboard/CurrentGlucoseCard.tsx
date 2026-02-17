// ============================================================================
// CurrentGlucoseCard - Main glucose reading display
// ============================================================================

import { Card, CardContent } from '../ui/card';
import { getTrendArrow, getTrendDescription } from '../../lib/utils';
import { formatGlucose as fmtGlucose, unitLabel } from '../../lib/glucose';
import { useDashboardStore } from '../../stores/dashboardStore';
import type { GlucoseEntry } from '../../lib/api';

interface Props {
  latest: GlucoseEntry | null;
  loading: boolean;
}

const LEVEL_CONFIG = {
  veryLow: {
    label: 'Muito Baixo',
    textClass: 'text-red-600 dark:text-red-400',
    bgClass: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  },
  low: {
    label: 'Baixo',
    textClass: 'text-orange-500 dark:text-orange-400',
    bgClass: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800',
    badgeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  },
  normal: {
    label: 'No Alvo',
    textClass: 'text-green-600 dark:text-green-400',
    bgClass: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
    badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  },
  high: {
    label: 'Alto',
    textClass: 'text-amber-500 dark:text-amber-400',
    bgClass: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  },
  veryHigh: {
    label: 'Muito Alto',
    textClass: 'text-red-600 dark:text-red-400',
    bgClass: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  },
};

function classifyGlucose(sgv: number): keyof typeof LEVEL_CONFIG {
  if (sgv < 54)  return 'veryLow';
  if (sgv < 70)  return 'low';
  if (sgv <= 180) return 'normal';
  if (sgv <= 250) return 'high';
  return 'veryHigh';
}

export function CurrentGlucoseCard({ latest, loading }: Props) {
  const { unit } = useDashboardStore();
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center justify-center gap-8 py-2">
            <div className="h-20 w-40 bg-muted animate-pulse rounded-md" />
            <div className="h-16 w-24 bg-muted animate-pulse rounded-md" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!latest) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-6 text-muted-foreground">
            Sem leitura disponível
          </div>
        </CardContent>
      </Card>
    );
  }

  const level = classifyGlucose(latest.sgv);
  const config = LEVEL_CONFIG[level];
  const trendArrow = getTrendArrow(latest.trend);
  const trendDesc = getTrendDescription(latest.trend);
  const deltaText = latest.delta !== undefined
    ? (() => {
        const d = unit === 'mmol'
          ? (latest.delta / 18.01)
          : latest.delta;
        return `${d > 0 ? '+' : ''}${d.toFixed(unit === 'mmol' ? 2 : 1)} ${unitLabel(unit)}`;
      })()
    : null;

  const ageMinutes = Math.floor((Date.now() - latest.date) / 60000);
  const isStale = ageMinutes > 15;

  return (
    <Card className={`border-2 ${config.bgClass}`}>
      <CardContent className="pt-6 pb-6">
        <div className="flex items-center justify-between gap-4">

          {/* Left: stale warning or empty spacer */}
          <div className="min-w-[80px]">
            {isStale && (
              <p className="text-xs font-medium text-red-500">⚠️ Dados antigos</p>
            )}
          </div>

          {/* Center: main glucose value */}
          <div className="flex-1 text-center">
            <div className={`text-7xl font-bold tabular-nums tracking-tight ${config.textClass}`}>
              {fmtGlucose(latest.sgv, unit)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">{unitLabel(unit)}</div>
            <div className="mt-2">
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${config.badgeClass}`}>
                {config.label}
              </span>
            </div>
          </div>

          {/* Right: trend arrow + description + delta */}
          <div className="text-right min-w-[80px]">
            <div className={`text-5xl leading-none ${config.textClass}`}>
              {trendArrow}
            </div>
            <p className={`text-xs font-medium mt-1 ${config.textClass}`}>
              {trendDesc}
            </p>
            {deltaText && (
              <p className={`text-sm font-bold mt-1 ${config.textClass}`}>
                {deltaText}
              </p>
            )}
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
