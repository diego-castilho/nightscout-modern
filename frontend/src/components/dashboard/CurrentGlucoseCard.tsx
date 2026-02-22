// ============================================================================
// CurrentGlucoseCard - Main glucose reading display
// ============================================================================

import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '../ui/card';
import { getTrendArrow, getTrendDescription, timeAgo } from '../../lib/utils';
import { formatGlucose as fmtGlucose, unitLabel } from '../../lib/glucose';
import { useDashboardStore } from '../../stores/dashboardStore';
import type { AlarmThresholds } from '../../stores/dashboardStore';
import type { GlucoseEntry } from '../../lib/api';
import { calcNSDelta } from '../../lib/glucoseDelta';
import { useIOB } from '../../hooks/useIOB';
import { useCOB } from '../../hooks/useCOB';
import { useDeviceAges } from '../../hooks/useDeviceAges';
import type { AgeLevel, DeviceAge } from '../../lib/deviceAge';

interface Props {
  latest: GlucoseEntry | null;
  previous?: GlucoseEntry | null;
  entries?: GlucoseEntry[];
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

function classifyGlucose(sgv: number, t: AlarmThresholds): keyof typeof LEVEL_CONFIG {
  if (sgv < t.veryLow) return 'veryLow';
  if (sgv < t.low)     return 'low';
  if (sgv <= t.high)   return 'normal';
  if (sgv <= t.veryHigh) return 'high';
  return 'veryHigh';
}

const AGE_PILL_CLASS: Record<AgeLevel, string> = {
  ok:      'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300',
  warn:    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  urgent:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  unknown: '',
};

// ── Device age pill with hover tooltip ────────────────────────────────────────

interface AgePillProps {
  deviceLabel: string;
  age: DeviceAge;
}

function AgePill({ deviceLabel, age }: AgePillProps) {
  const [visible, setVisible] = useState(false);

  const dateStr = age.createdAt
    ? format(new Date(age.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : null;

  return (
    <div
      className="relative"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <span
        className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full
                    cursor-default select-none ${AGE_PILL_CLASS[age.level]}`}
      >
        {deviceLabel} {age.label}
      </span>

      {visible && age.createdAt && (
        <div className="absolute left-0 top-full mt-1.5 z-50
                        bg-popover border border-border rounded-lg shadow-xl
                        p-2.5 text-xs min-w-[175px] whitespace-nowrap">
          <p className="font-semibold mb-1.5">{deviceLabel}</p>
          <div className="space-y-0.5 text-muted-foreground">
            <p>Trocado: <span className="text-foreground">{dateStr}</span></p>
            <p>Duração: <span className="text-foreground">{age.label}</span></p>
            {age.notes && (
              <p className="mt-1 italic text-foreground/70 whitespace-normal max-w-[200px]">
                {age.notes}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

export function CurrentGlucoseCard({ latest, previous, entries, loading }: Props) {
  const { unit, alarmThresholds } = useDashboardStore();
  const iob = useIOB();
  const cob = useCOB();
  const { sage, cage, iage, basalPen, rapidPen } = useDeviceAges();

  const hasDeviceAges = sage.hours != null || cage.hours != null || iage.hours != null || basalPen.hours != null || rapidPen.hours != null;

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

  const level = classifyGlucose(latest.sgv, alarmThresholds);
  const config = LEVEL_CONFIG[level];
  const trendArrow = getTrendArrow(latest.direction);
  const trendDesc = getTrendDescription(latest.direction);
  // Priority order for delta (mirrors Nightscout behaviour):
  // 1. Field stored by CGM app (`latest.delta`) — identical to what NS shows
  // 2. NS bucket averaging using all available entries (best for Libre 1-min data)
  // 3. Simple interpolated fallback using the immediately previous entry
  const rawDeltaMgdl = (() => {
    if (latest.delta !== undefined) return latest.delta;
    if (entries && entries.length > 1) return calcNSDelta(latest, entries);
    if (!previous) return undefined;
    const elapsedMins = (latest.date - previous.date) / 60_000;
    const absolute    = latest.sgv - previous.sgv;
    return elapsedMins > 9 ? Math.round(absolute / elapsedMins * 5) : Math.round(absolute);
  })();
  // Delta format mirrors Nightscout bgnow.js:
  //   mg/dL → integer with sign (+5, -3, 0)
  //   mmol  → 1 decimal with sign (+0.3, -0.2)
  const deltaText = rawDeltaMgdl !== undefined
    ? (() => {
        if (unit === 'mmol') {
          const d = rawDeltaMgdl / 18.01;
          return `${d > 0 ? '+' : ''}${d.toFixed(1)} ${unitLabel(unit)}`;
        }
        return `${rawDeltaMgdl > 0 ? '+' : ''}${rawDeltaMgdl} ${unitLabel(unit)}`;
      })()
    : null;

  const ageMinutes = Math.floor((Date.now() - latest.date) / 60000);
  const isStale = ageMinutes > 15;

  return (
    <Card className={`border-2 ${config.bgClass}`}>
      <CardContent className="pt-6 pb-6">
        <div className="flex items-center justify-between gap-4">

          {/* Left: device age pills + stale warning */}
          <div className="min-w-[90px] flex flex-col items-start gap-1.5">
            {isStale && (
              <p className="text-xs font-medium text-red-500">⚠️ Dados antigos</p>
            )}
            {hasDeviceAges && (
              <>
                {sage.hours != null && (
                  <AgePill deviceLabel="Sensor" age={sage} />
                )}
                {cage.hours != null && (
                  <AgePill deviceLabel="Site" age={cage} />
                )}
                {iage.hours != null && (
                  <AgePill deviceLabel="Insulina" age={iage} />
                )}
                {basalPen.hours != null && (
                  <AgePill deviceLabel="Basal" age={basalPen} />
                )}
                {rapidPen.hours != null && (
                  <AgePill deviceLabel="Rápida" age={rapidPen} />
                )}
              </>
            )}
          </div>

          {/* Center: main glucose value + IOB/COB */}
          <div className="flex-1 text-center">
            <div className={`text-7xl font-bold tabular-nums tracking-tight ${config.textClass}`}>
              {fmtGlucose(latest.sgv, unit)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">{unitLabel(unit)}</div>
            <div className="mt-2 flex flex-col items-center gap-1">
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${config.badgeClass}`}>
                {config.label}
              </span>
              <span className={`text-[11px] ${isStale ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                {timeAgo(latest.date)}
              </span>
            </div>
            {/* IOB / COB pills — only shown when there are active values */}
            {(iob >= 0.05 || cob >= 0.5) && (
              <div className="mt-2 flex justify-center gap-2 flex-wrap">
                {iob >= 0.05 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5
                                   rounded-full bg-blue-100 text-blue-700
                                   dark:bg-blue-900/40 dark:text-blue-300">
                    💉 IOB {iob.toFixed(2)} U
                  </span>
                )}
                {cob >= 0.5 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5
                                   rounded-full bg-orange-100 text-orange-700
                                   dark:bg-orange-900/40 dark:text-orange-300">
                    🍞 COB {cob.toFixed(1)} g
                  </span>
                )}
              </div>
            )}
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
