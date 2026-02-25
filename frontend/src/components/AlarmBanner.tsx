// ============================================================================
// AlarmBanner — fixed top banner for in-app alarm notifications
// ============================================================================

import { useAlarms } from '../hooks/useAlarms';
import { BellRing, X, AlarmClock } from 'lucide-react';
import { Button } from './ui/button';

export function AlarmBanner() {
  const { activeAlarm, dismissAlarm, snoozeAlarm } = useAlarms();

  if (!activeAlarm) return null;

  const isUrgent = activeAlarm.level === 'urgent';
  const bgClass  = isUrgent ? 'bg-destructive text-destructive-foreground' : 'bg-amber-500 text-white';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-4 py-3 shadow-lg ${bgClass}`}
    >
      <BellRing className="h-5 w-5 shrink-0 animate-pulse" />

      <span className="flex-1 text-sm font-medium leading-tight">
        {activeAlarm.message}
      </span>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="h-7 border-white/40 bg-white/10 text-inherit hover:bg-white/20 text-xs gap-1"
          onClick={snoozeAlarm}
        >
          <AlarmClock className="h-3.5 w-3.5" />
          Snooze 30 min
        </Button>

        <button
          type="button"
          aria-label="Fechar alarme"
          className="p-1 rounded hover:bg-white/20 transition-colors"
          onClick={dismissAlarm}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
