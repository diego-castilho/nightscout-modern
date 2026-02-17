// ============================================================================
// DashboardPage - Main glucose monitoring dashboard
// ============================================================================

import { useEffect, useState } from 'react';
import { useGlucoseData } from '../hooks/useGlucoseData';
import { useDashboardStore, getPeriodDates } from '../stores/dashboardStore';
import { detectPatterns } from '../lib/api';
import type { DetectedPattern } from '../lib/api';

import { PeriodSelector } from '../components/layout/PeriodSelector';
import { CurrentGlucoseCard } from '../components/dashboard/CurrentGlucoseCard';
import { StatsGrid } from '../components/dashboard/StatsGrid';
import { PatternsAlert } from '../components/dashboard/PatternsAlert';
import { GlucoseAreaChart } from '../components/charts/GlucoseAreaChart';
import { TIRChart } from '../components/charts/TIRChart';
import { DailyPatternChart } from '../components/charts/DailyPatternChart';

import { Button } from '../components/ui/button';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function DashboardPage() {
  const { period, lastRefresh, triggerRefresh } = useDashboardStore();
  const { entries, latest, analytics, loading, error } = useGlucoseData();
  const [patterns, setPatterns] = useState<DetectedPattern[]>([]);
  const [patternsLoading, setPatternsLoading] = useState(true);

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
