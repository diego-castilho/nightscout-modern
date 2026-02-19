import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Glucose value classification
export function getGlucoseLevel(sgv: number): 'veryLow' | 'low' | 'normal' | 'high' | 'veryHigh' {
  if (sgv < 54) return 'veryLow';
  if (sgv < 70) return 'low';
  if (sgv <= 180) return 'normal';
  if (sgv <= 250) return 'high';
  return 'veryHigh';
}

// Get color class for glucose value
export function getGlucoseColor(sgv: number): string {
  const level = getGlucoseLevel(sgv);
  return `glucose-color-${level}`;
}

// Get background color class for glucose value
export function getGlucoseBgColor(sgv: number): string {
  const level = getGlucoseLevel(sgv);
  return `glucose-bg-${level}`;
}

// Format glucose value with units
export function formatGlucose(sgv: number, units: 'mg/dl' | 'mmol/l' = 'mg/dl'): string {
  if (units === 'mmol/l') {
    return (sgv / 18).toFixed(1);
  }
  return sgv.toString();
}

// Get trend arrow symbol — mirrors Nightscout direction.js dir2Char mapping
export function getTrendArrow(direction: string | undefined): string {
  if (!direction) return '-';

  const dir2Char: Record<string, string> = {
    'NONE':              '⇼',
    'TripleUp':          '⤊',
    'DoubleUp':          '⇈',
    'SingleUp':          '↑',
    'FortyFiveUp':       '↗',
    'Flat':              '→',
    'FortyFiveDown':     '↘',
    'SingleDown':        '↓',
    'DoubleDown':        '⇊',
    'TripleDown':        '⤋',
    'NOT COMPUTABLE':    '-',
    'RATE OUT OF RANGE': '⇕',
  };

  return dir2Char[direction] ?? '-';
}

// Get trend description in Portuguese
export function getTrendDescription(direction: string | undefined): string {
  if (!direction) return 'Indisponível';

  const descriptions: Record<string, string> = {
    'NONE':              'Não calculável',
    'TripleUp':          'Subindo muito rápido',
    'DoubleUp':          'Subindo rapidamente',
    'SingleUp':          'Subindo',
    'FortyFiveUp':       'Subindo levemente',
    'Flat':              'Estável',
    'FortyFiveDown':     'Descendo levemente',
    'SingleDown':        'Descendo',
    'DoubleDown':        'Descendo rapidamente',
    'TripleDown':        'Descendo muito rápido',
    'NOT COMPUTABLE':    'Não calculável',
    'RATE OUT OF RANGE': 'Fora do intervalo',
  };

  return descriptions[direction] ?? 'Indisponível';
}

// Calculate time ago (em português)
export function timeAgo(date: number | Date): string {
  const now = Date.now();
  const timestamp = typeof date === 'number' ? date : date.getTime();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1)  return 'agora';
  if (diffMins < 60) return `há ${diffMins} min`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `há ${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  return `há ${diffDays}d`;
}
