// ============================================================================
// CurrentGlucoseCard - Main glucose reading display
// ============================================================================

import { Card, CardContent } from '../ui/card';
import { formatGlucose, getTrendArrow, getTrendDescription, getGlucoseLevel, timeAgo } from '../../lib/utils';
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

export function CurrentGlucoseCard({ latest, loading }: Props) {
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

  const level = getGlucoseLevel(latest.sgv);
  const config = LEVEL_CONFIG[level];
  const trendArrow = getTrendArrow(latest.trend);
  const trendDesc = getTrendDescription(latest.trend);
  const deltaText = latest.delta !== undefined
    ? `${latest.delta > 0 ? '+' : ''}${latest.delta.toFixed(1)} mg/dL`
    : null;

  const readingAge = new Date(latest.date);
  const ageMinutes = Math.floor((Date.now() - readingAge.getTime()) / 60000);
  const isStale = ageMinutes > 15;

  return (
    <Card className={`border-2 ${config.bgClass}`}>
      <CardContent className="pt-6 pb-6">
        <div className="flex items-center justify-between gap-4">

          {/* Left: timestamp + device */}
          <div className="text-left min-w-[80px]">
            <p className={`text-xs font-medium ${isStale ? 'text-red-500' : 'text-muted-foreground'}`}>
              {isStale ? '⚠️ Dados antigos' : timeAgo(readingAge)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {latest.device ? latest.device.split(' ')[0] : 'CGM'}
            </p>
          </div>

          {/* Center: main glucose value */}
          <div className="flex-1 text-center">
            <div className={`text-7xl font-bold tabular-nums tracking-tight ${config.textClass}`}>
              {formatGlucose(latest.sgv)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">mg/dL</div>
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
