// ============================================================================
// Header - Top navigation bar
// ============================================================================

import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Moon, Sun, RefreshCw, Activity, Settings, ArrowLeft, Menu, BarChart2, BarChart, Plus, Syringe, Calculator, LogOut, CalendarDays, CalendarRange, Clock, BookOpen, Utensils, FileText, TrendingUp, HelpCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { useTheme } from '../../hooks/useTheme';
import { useDashboardStore } from '../../stores/dashboardStore';
import { useAuthStore } from '../../stores/authStore';
import { TreatmentModal } from '../careportal/TreatmentModal';
import { BolusCalculatorModal } from '../careportal/BolusCalculatorModal';
import type { EventTypeValue } from '../careportal/TreatmentModal';

interface HeaderProps {
  lastUpdated?: Date | null;
}

export function Header({ lastUpdated }: HeaderProps) {
  const { darkMode, cycleTheme } = useTheme();
  const { triggerRefresh, patientName } = useDashboardStore();
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();
  const navigate = useNavigate();
  const isSubpage = ['/settings', '/comparisons', '/treatments', '/calendar', '/weekly', '/hourly', '/distribution', '/daily', '/meals', '/agp', '/spaghetti', '/help'].includes(location.pathname);

  const [menuOpen,  setMenuOpen]  = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [calcOpen,  setCalcOpen]  = useState(false);
  const [treatInitialValues, setTreatInitialValues] = useState<{
    eventType?: EventTypeValue;
    insulin?:   string;
    carbs?:     string;
    glucose?:   string;
  } | undefined>(undefined);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [menuOpen]);

  const formatLastUpdated = (date: Date | null | undefined) => {
    if (!date) return '';
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          {/* Logo / Back button */}
          <div className="flex items-center gap-2">
            {isSubpage ? (
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
            {!isSubpage && lastUpdated && (
              <span className="text-xs text-muted-foreground hidden sm:block">
                Atualizado às {formatLastUpdated(lastUpdated)}
              </span>
            )}

            {!isSubpage && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => triggerRefresh()}
                title="Atualizar dados"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}

            {/* Calculadora de bolus */}
            {!isSubpage && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCalcOpen(true)}
                title="Calculadora de Bolus"
              >
                <Calculator className="h-4 w-4" />
              </Button>
            )}

            {/* Registrar tratamento */}
            {!isSubpage && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setModalOpen(true)}
                title="Registrar tratamento"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}

            {/* Ciclo de tema: Padrão Claro → Padrão Escuro → Dracula Claro → Dracula Escuro */}
            <Button
              variant="ghost"
              size="icon"
              onClick={cycleTheme}
              title={darkMode ? 'Modo Escuro → Modo Claro' : 'Modo Claro → Modo Escuro'}
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <div className="relative" ref={menuRef}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMenuOpen((v) => !v)}
                  title="Menu"
                >
                  <Menu className="h-4 w-4" />
                </Button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-background border border-border rounded-md shadow-lg py-1 min-w-[170px] z-50">
                    <button
                      onClick={() => { navigate('/daily'); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                    >
                      <BookOpen className="h-4 w-4" />
                      Log Diário
                    </button>
                    <button
                      onClick={() => { navigate('/treatments'); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                    >
                      <Syringe className="h-4 w-4" />
                      Tratamentos
                    </button>
                    <button
                      onClick={() => { navigate('/calendar'); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                    >
                      <CalendarDays className="h-4 w-4" />
                      Calendário
                    </button>
                    <button
                      onClick={() => { navigate('/weekly'); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                    >
                      <CalendarRange className="h-4 w-4" />
                      Resumo Semanal
                    </button>
                    <button
                      onClick={() => { navigate('/hourly'); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                    >
                      <Clock className="h-4 w-4" />
                      Stats Horárias
                    </button>
                    <button
                      onClick={() => { navigate('/distribution'); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                    >
                      <BarChart className="h-4 w-4" />
                      Distribuição
                    </button>
                    <button
                      onClick={() => { navigate('/meals'); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                    >
                      <Utensils className="h-4 w-4" />
                      Padrões de Refeição
                    </button>
                    <button
                      onClick={() => { navigate('/spaghetti'); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                    >
                      <TrendingUp className="h-4 w-4" />
                      Gráfico Spaghetti
                    </button>
                    <button
                      onClick={() => { navigate('/agp'); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                    >
                      <FileText className="h-4 w-4" />
                      Relatório AGP
                    </button>
                    <button
                      onClick={() => { navigate('/comparisons'); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                    >
                      <BarChart2 className="h-4 w-4" />
                      Comparações
                    </button>
                    <button
                      onClick={() => { navigate('/settings'); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                    >
                      <Settings className="h-4 w-4" />
                      Configurações
                    </button>
                    <button
                      onClick={() => { navigate('/help'); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                    >
                      <HelpCircle className="h-4 w-4" />
                      Documentação
                    </button>
                    <div className="border-t border-border my-1" />
                    <button
                      onClick={() => { logout(); navigate('/login'); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left text-destructive"
                    >
                      <LogOut className="h-4 w-4" />
                      Sair
                    </button>
                  </div>
                )}
              </div>
          </div>
        </div>
      </header>

      {/* Calculadora de bolus */}
      {calcOpen && (
        <BolusCalculatorModal
          onClose={() => setCalcOpen(false)}
          onRegister={(eventType, values) => {
            setTreatInitialValues({ eventType, ...values });
            setCalcOpen(false);
            setModalOpen(true);
          }}
        />
      )}

      {/* Modal de tratamento */}
      {modalOpen && (
        <TreatmentModal
          onClose={() => { setModalOpen(false); setTreatInitialValues(undefined); }}
          onSuccess={() => { triggerRefresh(); setTreatInitialValues(undefined); }}
          initialValues={treatInitialValues}
        />
      )}
    </>
  );
}
