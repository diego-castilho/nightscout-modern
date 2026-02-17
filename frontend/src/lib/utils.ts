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

// Get trend arrow symbol
export function getTrendArrow(trend: number | undefined): string {
  if (trend === undefined) return '→';

  const arrows: { [key: number]: string } = {
    '-2': '⇊', // DoubleDown
    '-1': '↓', // SingleDown
    '0': '→',  // Flat
    '1': '↑',  // SingleUp
    '2': '⇈',  // DoubleUp
  };

  return arrows[trend] || '→';
}

// Get trend description
export function getTrendDescription(trend: number | undefined): string {
  if (trend === undefined) return 'Stable';

  const descriptions: { [key: number]: string } = {
    '-2': 'Dropping rapidly',
    '-1': 'Dropping',
    '0': 'Stable',
    '1': 'Rising',
    '2': 'Rising rapidly',
  };

  return descriptions[trend] || 'Stable';
}

// Calculate time ago
export function timeAgo(date: number | Date): string {
  const now = Date.now();
  const timestamp = typeof date === 'number' ? date : date.getTime();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return 'just now';
  if (diffMins === 1) return '1 min ago';
  if (diffMins < 60) return `${diffMins} mins ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
}
