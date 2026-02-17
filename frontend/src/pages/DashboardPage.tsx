// ============================================================================
// DashboardPage - Main glucose monitoring dashboard
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { useGlucoseData } from '../hooks/useGlucoseData';
import { useDashboardStore, getPeriodDates } from '../stores/dashboardStore';
import { detectPatterns } from '../lib/api';
import { formatGlucose, unitLabel } from '../lib/glucose';
import type { DetectedPattern } from '../lib/api';

import { PeriodSelector } from '../components/layout/PeriodSelector';
import { CurrentGlucoseCard } from '../components/dashboard/CurrentGlucoseCard';
import { StatsGrid } from '../components/dashboard/StatsGrid';
import { PatternsAlert } from '../components/dashboard/PatternsAlert';
import { GlucoseAreaChart } from '../components/charts/GlucoseAreaChart';
import { TIRChart } from '../components/charts/TIRChart';
import { DailyPatternChart } from '../components/charts/DailyPatternChart';

import { Button } from '../components/ui/button';
import { AlertCircle, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

const COOLDOWN_MS = 15 * 60 * 1000; // 15 min between visual alerts per zone

export function DashboardPage() {
  const { period, lastRefresh, triggerRefresh, unit, alarmThresholds } = useDashboardStore();
  const { entries, latest, analytics, loading, error } = useGlucoseData();
  const [patterns, setPatterns] = useState<DetectedPattern[]>([]);
  const [patternsLoading, setPatternsLoading] = useState(true);

  // Visual alert banner state
  const [alarmBanner, setAlarmBanner] = useState<{ zone: string; sgv: number } | null>(null);
  const lastAlertRef = useRef<{ zone: string; time: number } | null>(null);
  const lastProcessedKey = useRef<string | null>(null);

  // Detect threshold crossings and show banner (no audio)
  useEffect(() => {
    if (!latest) return;
    const { sgv } = latest;
    const { veryLow, low, high, veryHigh } = alarmThresholds;

    const key = `${sgv}|${veryLow}-${low}-${high}-${veryHigh}`;
    if (key === lastProcessedKey.current) return;
    lastProcessedKey.current = key;

    let zone: string | null = null;
    if (sgv <= veryLow)       zone = 'urgentLow';
    else if (sgv <= low)      zone = 'low';
    else if (sgv >= veryHigh) zone = 'veryHigh';
    else if (sgv >= high)     zone = 'high';

    if (!zone) return;

    const now = Date.now();
    if (lastAlertRef.current?.zone === zone && now - lastAlertRef.current.time < COOLDOWN_MS) return;

    lastAlertRef.current = { zone, time: now };
    setAlarmBanner({ zone, sgv });
    setTimeout(() => setAlarmBanner(null), 2 * 60 * 1000);
  }, [latest, alarmThresholds]);

  // Fetch detected patterns separately (can be slow)
  useEffect(() => {
    let cancelled = false;
    setPatternsLoading(true);

    const { startDate, endDate } = getPeriodDates(period);
    detectPatterns(startDate, endDate)
      .then((data) => {
        if (!cancelled) {
          setPatterns(data ?? []);
          setPatternsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPatterns([]);
          setPatternsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [period, lastRefresh]);

  const lastUpdated = latest ? new Date(latest.date) : null;
  const sgvDisplay = (sgv: number) => `${formatGlucose(sgv, unit)} ${unitLabel(unit)}`;

  if (error && !loading && !latest) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Erro ao carregar dados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => triggerRefresh()} variant="outline" className="w-full">
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <main className="container mx-auto px-4 py-4 max-w-5xl">
      <div className="space-y-4">
        {/* Period selector */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <PeriodSelector />
          <p className="text-xs text-muted-foreground">
            {analytics ? `${analytics.totalReadings} leituras · ${analytics.period.days} dias` : ''}
            {lastUpdated && (
              <span className="ml-2">
                · atualizado às {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>

        {/* Alarm banner */}
        {alarmBanner && (
          <div className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm font-medium ${
            alarmBanner.zone === 'urgentLow' || alarmBanner.zone === 'veryHigh'
              ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300'
              : 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300'
          }`}>
            <span>
              {alarmBanner.zone === 'urgentLow'  && `🚨 Glicose muito baixa! ${sgvDisplay(alarmBanner.sgv)}`}
              {alarmBanner.zone === 'low'         && `⚠️ Glicose baixa! ${sgvDisplay(alarmBanner.sgv)}`}
              {alarmBanner.zone === 'high'        && `⚠️ Glicose alta! ${sgvDisplay(alarmBanner.sgv)}`}
              {alarmBanner.zone === 'veryHigh'    && `🚨 Glicose muito alta! ${sgvDisplay(alarmBanner.sgv)}`}
            </span>
            <button onClick={() => setAlarmBanner(null)} className="opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Current glucose - prominent */}
        <CurrentGlucoseCard latest={latest} loading={loading} />

        {/* Main chart */}
        <GlucoseAreaChart entries={entries} loading={loading} />

        {/* Stats grid */}
        <StatsGrid analytics={analytics} loading={loading} />

        {/* TIR + Daily Pattern */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TIRChart
            tir={analytics?.timeInRange ?? null}
            loading={loading}
            totalReadings={analytics?.totalReadings}
          />
          <DailyPatternChart />
        </div>

        {/* Detected patterns */}
        <PatternsAlert patterns={patterns} loading={patternsLoading} />
      </div>
    </main>
  );
}
