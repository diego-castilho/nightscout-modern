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
    pulseClass: 'animate-pulse',
  },
  low: {
    label: 'Baixo',
    textClass: 'text-orange-500 dark:text-orange-400',
    bgClass: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800',
    pulseClass: '',
  },
  normal: {
    label: 'No Alvo',
    textClass: 'text-green-600 dark:text-green-400',
    bgClass: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
    pulseClass: '',
  },
  high: {
    label: 'Alto',
    textClass: 'text-amber-500 dark:text-amber-400',
    bgClass: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
    pulseClass: '',
  },
  veryHigh: {
    label: 'Muito Alto',
    textClass: 'text-red-600 dark:text-red-400',
    bgClass: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
    pulseClass: '',
  },
};

export function CurrentGlucoseCard({ latest, loading }: Props) {
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-6">
            <div className="h-20 w-48 bg-muted animate-pulse rounded-md mx-auto mb-3" />
            <div className="h-4 w-32 bg-muted animate-pulse rounded mx-auto" />
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
    ? `${latest.delta > 0 ? '+' : ''}${latest.delta.toFixed(1)}`
    : null;

  const readingAge = new Date(latest.date);
  const ageMinutes = Math.floor((Date.now() - readingAge.getTime()) / 60000);
  const isStale = ageMinutes > 15;

  return (
    <Card className={`border-2 ${config.bgClass}`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          {/* Main reading */}
          <div className="flex-1">
            <div className={`flex items-baseline gap-3 ${config.pulseClass}`}>
              <span className={`text-7xl font-bold tabular-nums tracking-tight ${config.textClass}`}>
                {formatGlucose(latest.sgv)}
              </span>
              <div className="flex flex-col">
                <span className={`text-4xl font-light ${config.textClass}`}>{trendArrow}</span>
                {deltaText && (
                  <span className={`text-sm font-medium ${config.textClass}`}>{deltaText}</span>
                )}
              </div>
            </div>

            <div className="mt-2 flex items-center gap-3 flex-wrap">
              <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${
                level === 'normal'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
              }`}>
                {config.label}
              </span>
              <span className="text-sm text-muted-foreground">{trendDesc}</span>
            </div>
          </div>

          {/* Time info */}
          <div className="text-right">
            <p className={`text-xs font-medium ${isStale ? 'text-red-500' : 'text-muted-foreground'}`}>
              {isStale ? '⚠️ Dados antigos' : timeAgo(readingAge)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {latest.device || 'CGM'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
