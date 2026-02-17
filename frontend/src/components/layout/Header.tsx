// ============================================================================
// Header - Top navigation bar
// ============================================================================

import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Moon, Sun, RefreshCw, Activity, Bell, BellOff, Settings, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { useTheme } from '../../hooks/useTheme';
import { useDashboardStore } from '../../stores/dashboardStore';
import { globalAudioAlarm } from '../../lib/audioAlarm';

interface HeaderProps {
  lastUpdated?: Date | null;
}

export function Header({ lastUpdated }: HeaderProps) {
  const { darkMode, toggleDarkMode } = useTheme();
  const { triggerRefresh, alarmEnabled, toggleAlarm, patientName } = useDashboardStore();
  const location = useLocation();
  const navigate = useNavigate();
  const isSettings = location.pathname === '/settings';

  async function handleAlarmToggle() {
    const next = !alarmEnabled;
    if (next) {
      await globalAudioAlarm.enable();   // await ensures context is 'running'
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
        {/* Logo / Back button */}
        <div className="flex items-center gap-2">
          {isSettings ? (
            <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span>Dashboard</span>
            </Link>
          ) : (
            <>
              <Activity className="h-5 w-5 text-green-500" />
              <span className="font-bold text-lg tracking-tight">Nightscout Modern</span>
              {patientName && (
                <span className="hidden sm:inline text-sm text-muted-foreground">
                  · {patientName}
                </span>
              )}
            </>
          )}
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {!isSettings && lastUpdated && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              Atualizado às {formatLastUpdated(lastUpdated)}
            </span>
          )}

          {!isSettings && (
            <>
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
            </>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDarkMode}
            title={darkMode ? 'Modo claro' : 'Modo escuro'}
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {!isSettings && (
            <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} title="Configurações">
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
