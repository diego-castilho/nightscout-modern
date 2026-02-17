// ============================================================================
// PeriodSelector - Date range period buttons
// ============================================================================

import { useDashboardStore, type Period } from '../../stores/dashboardStore';
import { Button } from '../ui/button';

const PERIODS: { label: string; value: Period }[] = [
  { label: '3h', value: '3h' },
  { label: '6h', value: '6h' },
  { label: '12h', value: '12h' },
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
  { label: '14d', value: '14d' },
  { label: '30d', value: '30d' },
];

export function PeriodSelector() {
  const { period, setPeriod } = useDashboardStore();

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {PERIODS.map(({ label, value }) => (
        <Button
          key={value}
          variant={period === value ? 'default' : 'outline'}
          size="sm"
          onClick={() => setPeriod(value)}
          className="h-8 px-3 text-xs font-medium"
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
