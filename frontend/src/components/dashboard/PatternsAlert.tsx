// ============================================================================
// PatternsAlert - Detected glucose patterns alerts
// ============================================================================

import { AlertTriangle, AlertCircle, Info, TrendingUp, Moon, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { DetectedPattern } from '../../lib/api';

interface Props {
  patterns: DetectedPattern[];
  loading: boolean;
}

const PATTERN_CONFIG: Record<string, {
  icon: typeof AlertTriangle;
  label: string;
  description: string;
}> = {
  dawn_phenomenon: {
    icon: TrendingUp,
    label: 'Fenômeno do Amanhecer',
    description: 'Glicose elevada nas primeiras horas da manhã (4h-8h)',
  },
  nocturnal_hypoglycemia: {
    icon: Moon,
    label: 'Hipoglicemia Noturna',
    description: 'Episódios de glicose baixa durante a madrugada',
  },
  high_variability: {
    icon: Zap,
    label: 'Alta Variabilidade',
    description: 'Coeficiente de variação acima do recomendado (>40%)',
  },
  post_meal_spike: {
    icon: TrendingUp,
    label: 'Pico Pós-Refeição',
    description: 'Elevação acentuada após refeições',
  },
};

const SEVERITY_CONFIG = {
  low: {
    icon: Info,
    label: 'Leve',
    cardClass: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20',
    titleClass: 'text-blue-700 dark:text-blue-300',
    iconClass: 'text-blue-500',
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  },
  medium: {
    icon: AlertTriangle,
    label: 'Moderado',
    cardClass: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20',
    titleClass: 'text-amber-700 dark:text-amber-300',
    iconClass: 'text-amber-500',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  },
  high: {
    icon: AlertCircle,
    label: 'Grave',
    cardClass: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20',
    titleClass: 'text-red-700 dark:text-red-300',
    iconClass: 'text-red-500',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  },
};

export function PatternsAlert({ patterns, loading }: Props) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Padrões Detectados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!patterns || patterns.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Padrões Detectados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <Info className="h-4 w-4" />
            <p className="text-sm">Nenhum padrão preocupante detectado no período.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Padrões Detectados
          <span className="text-xs font-normal bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 px-2 py-0.5 rounded-full">
            {patterns.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {patterns.map((pattern, idx) => {
            const config = PATTERN_CONFIG[pattern.type] ?? {
              icon: AlertTriangle,
              label: pattern.type,
              description: pattern.description,
            };
            const severity = SEVERITY_CONFIG[pattern.severity];
            const PatternIcon = config.icon;

            return (
              <div
                key={idx}
                className={`flex gap-3 p-3 rounded-lg border ${severity.cardClass}`}
              >
                <PatternIcon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${severity.iconClass}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-semibold ${severity.titleClass}`}>
                      {config.label}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${severity.badgeClass}`}>
                      {severity.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{pattern.description}</p>
                  {pattern.averageGlucose && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Média: {pattern.averageGlucose.toFixed(0)} mg/dL
                    </p>
                  )}
                  {pattern.hours && pattern.hours.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Horários: {pattern.hours.map((h) => `${h}h`).join(', ')}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
