// ============================================================================
// periods.ts — Opções de período para páginas de análise clínica
//
// Uso:
//   import { PERIOD_OPTIONS } from '../lib/periods';
//   const PERIODS = PERIOD_OPTIONS;              // todas as opções
//   const PERIODS = PERIOD_OPTIONS.slice(0, 2);  // só 7 e 14 dias
// ============================================================================

export const PERIOD_OPTIONS = [
  { label: '7 dias',  days: 7  },
  { label: '14 dias', days: 14 },
  { label: '30 dias', days: 30 },
] as const;

export type PeriodOption = typeof PERIOD_OPTIONS[number];
