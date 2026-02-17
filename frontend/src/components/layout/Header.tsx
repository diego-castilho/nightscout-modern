// ============================================================================
// Header - Top navigation bar
// ============================================================================

import { Moon, Sun, RefreshCw, Activity, Bell, BellOff } from 'lucide-react';
import { Button } from '../ui/button';
import { useTheme } from '../../hooks/useTheme';
import { useDashboardStore } from '../../stores/dashboardStore';
import { globalAudioAlarm } from '../../lib/audioAlarm';

interface HeaderProps {
  lastUpdated?: Date | null;
}

export function Header({ lastUpdated }: HeaderProps) {
  const { darkMode, toggleDarkMode } = useTheme();
  const { triggerRefresh, alarmEnabled, toggleAlarm } = useDashboardStore();

  function handleAlarmToggle() {
    const next = !alarmEnabled;
    if (next) {
      // Must create AudioContext inside user gesture
      globalAudioAlarm.enable();
      globalAudioAlarm.playConfirmation();
    } else {
      globalAudioAlarm.disable();
    }
    toggleAlarm();
  }

  const formatLastUpdated = (date: Date | null | undefined) => {
    if (!date) return '';
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-green-500" />
          <span className="font-bold text-lg tracking-tight">Nightscout Modern</span>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              Atualizado às {formatLastUpdated(lastUpdated)}
            </span>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => triggerRefresh()}
            title="Atualizar dados"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleAlarmToggle}
            title={alarmEnabled ? 'Desativar alarme sonoro' : 'Ativar alarme sonoro'}
            className={alarmEnabled ? 'text-green-500 dark:text-green-400' : ''}
          >
            {alarmEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDarkMode}
            title={darkMode ? 'Modo claro' : 'Modo escuro'}
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
