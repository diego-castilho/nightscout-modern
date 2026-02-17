// ============================================================================
// StatsGrid - Statistics cards grid (avg, GMI, A1c, CV%)
// ============================================================================

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { GlucoseAnalytics } from '../../lib/api';

interface Props {
  analytics: GlucoseAnalytics | null;
  loading: boolean;
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  status?: 'good' | 'warning' | 'bad' | 'neutral';
  loading?: boolean;
}

function StatCard({ title, value, subtitle, status = 'neutral', loading }: StatCardProps) {
  const statusColors = {
    good: 'text-green-600 dark:text-green-400',
    warning: 'text-amber-500 dark:text-amber-400',
    bad: 'text-red-600 dark:text-red-400',
    neutral: 'text-foreground',
  };

  return (
    <Card>
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {loading ? (
          <div className="h-8 w-24 bg-muted animate-pulse rounded" />
        ) : (
          <>
            <p className={`text-2xl font-bold ${statusColors[status]}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function StatsGrid({ analytics, loading }: Props) {
  if (loading || !analytics) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <StatCard key={i} title="..." value="" subtitle="" loading={true} />
        ))}
      </div>
    );
  }

  const { stats, period } = analytics;

  // CV% status: good <36%, warning 36-50%, bad >50%
  const cvStatus = stats.cv < 36 ? 'good' : stats.cv < 50 ? 'warning' : 'bad';

  // GMI status: good <7%, warning 7-8%, bad >8%
  const gmiStatus = stats.gmi < 7 ? 'good' : stats.gmi < 8 ? 'warning' : 'bad';

  // A1c status: good <7%, warning 7-8%, bad >8%
  const a1cStatus = stats.estimatedA1c < 7 ? 'good' : stats.estimatedA1c < 8 ? 'warning' : 'bad';

  // Average glucose status: 70-154 mg/dL = good
  const avgStatus = stats.average >= 70 && stats.average <= 154 ? 'good' :
    stats.average < 54 || stats.average > 250 ? 'bad' : 'warning';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard
        title="Média"
        value={`${stats.average.toFixed(0)} mg/dL`}
        subtitle={`Mediana: ${stats.median.toFixed(0)} mg/dL`}
        status={avgStatus}
      />
      <StatCard
        title="GMI"
        value={`${stats.gmi.toFixed(1)}%`}
        subtitle="Glucose Management Indicator"
        status={gmiStatus}
      />
      <StatCard
        title="A1c Est."
        value={`${stats.estimatedA1c.toFixed(1)}%`}
        subtitle={`${period.days} dias analisados`}
        status={a1cStatus}
      />
      <StatCard
        title="CV%"
        value={`${stats.cv.toFixed(1)}%`}
        subtitle={`Alvo <36% • DesvPad: ${stats.stdDev.toFixed(0)}`}
        status={cvStatus}
      />
    </div>
  );
}
