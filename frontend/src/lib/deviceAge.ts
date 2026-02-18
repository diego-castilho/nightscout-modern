// ============================================================================
// deviceAge — Age tracking for CGM sensor, infusion site and insulin
// ============================================================================
// SAGE (Sensor AGE):  tracks time since last Sensor Change treatment.
// CAGE (CAnnula AGE): tracks time since last Site Change treatment.
// IAGE (Insulin AGE): tracks time since last Insulin Change treatment
//                     (pump reservoir, opened vial, or undifferentiated pen).
// Basal Pen Age:      tracks time since last Basal Pen Change treatment.
// Rapid Pen Age:      tracks time since last Rapid Pen Change treatment.
//
// IAGE uses the same thresholds as pen ages (penWarnD / penUrgentD) since all
// refer to the same concept: insulin stability after opening (~28-30 days).
// ============================================================================

import type { Treatment } from './api';

export type AgeLevel = 'ok' | 'warn' | 'urgent' | 'unknown';

export interface DeviceAge {
  hours: number | null;      // null = no event found
  level: AgeLevel;
  label: string;             // formatted string e.g. "2d 3h" or "5h"
  createdAt: string | null;  // ISO timestamp of the source treatment
  notes?: string;            // optional notes from the treatment
}

export interface DeviceAgeThresholds {
  sageWarnD:   number;  // default 10d — sensor warning threshold (days)
  sageUrgentD: number;  // default 14d — sensor urgent threshold (days)
  cageWarnH:   number;  // default 48h — cannula warning threshold (hours)
  cageUrgentH: number;  // default 72h — cannula urgent threshold (hours)
  penWarnD:    number;  // default 20d — insulin/pen warning threshold (days)
  penUrgentD:  number;  // default 28d — insulin/pen urgent threshold (days)
}

export const DEFAULT_DEVICE_AGE_THRESHOLDS: DeviceAgeThresholds = {
  sageWarnD:   10,
  sageUrgentD: 14,
  cageWarnH:   48,
  cageUrgentH: 72,
  penWarnD:    20,
  penUrgentD:  28,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the most recent treatment of the given eventType from the list,
 * or null if none found.
 */
function latestOf(treatments: Treatment[], eventType: string): Treatment | null {
  let best: Treatment | null = null;
  let bestTime = -Infinity;
  for (const t of treatments) {
    if (t.eventType !== eventType) continue;
    const ts = new Date(t.created_at).getTime();
    if (ts > bestTime) { best = t; bestTime = ts; }
  }
  return best;
}

/**
 * Formats elapsed hours into a human-readable string.
 * If showHours is true (CAGE/SAGE): < 24h → "Xh", ≥ 24h → "Xd Yh"
 * If showHours is false (IAGE/pens): < 24h → "Xh", ≥ 24h → "Xd"
 */
export function formatAge(totalHours: number, showHours = true): string {
  if (totalHours < 24) return `${Math.floor(totalHours)}h`;
  const days  = Math.floor(totalHours / 24);
  const hours = Math.floor(totalHours % 24);
  if (!showHours || hours === 0) return `${days}d`;
  return `${days}d ${hours}h`;
}

function ageLevel(hours: number, warnH: number, urgentH: number): AgeLevel {
  if (hours >= urgentH) return 'urgent';
  if (hours >= warnH)   return 'warn';
  return 'ok';
}

function buildDeviceAge(
  treatment: Treatment | null,
  warnH: number,
  urgentH: number,
  showHours: boolean,
): DeviceAge {
  if (!treatment) return { hours: null, level: 'unknown', label: '—', createdAt: null };
  const hours = (Date.now() - new Date(treatment.created_at).getTime()) / 3_600_000;
  const level = ageLevel(hours, warnH, urgentH);
  return {
    hours,
    level,
    label: formatAge(hours, showHours),
    createdAt: treatment.created_at,
    notes: treatment.notes,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface DeviceAges {
  sage:     DeviceAge;
  cage:     DeviceAge;
  iage:     DeviceAge;  // generic insulin change
  basalPen: DeviceAge;
  rapidPen: DeviceAge;
}

/**
 * Calculates the age of CGM sensor, infusion site and insulin from a list of
 * treatments (should cover at least the last 35 days).
 * Falls back to DEFAULT_DEVICE_AGE_THRESHOLDS for any missing threshold fields
 * (handles graceful migration when new fields are added).
 */
export function calculateDeviceAges(
  treatments: Treatment[],
  thresholds: Partial<DeviceAgeThresholds> = {},
): DeviceAges {
  const t: DeviceAgeThresholds = { ...DEFAULT_DEVICE_AGE_THRESHOLDS, ...thresholds };

  const sensorChange  = latestOf(treatments, 'Sensor Change');
  const siteChange    = latestOf(treatments, 'Site Change');
  const insulinChange = latestOf(treatments, 'Insulin Change');
  const basalChange   = latestOf(treatments, 'Basal Pen Change');
  const rapidChange   = latestOf(treatments, 'Rapid Pen Change');

  const sageWarnH  = t.sageWarnD   * 24;
  const sageUrgH   = t.sageUrgentD * 24;
  const penWarnH   = t.penWarnD    * 24;
  const penUrgentH = t.penUrgentD  * 24;

  return {
    sage:     buildDeviceAge(sensorChange,  sageWarnH,     sageUrgH,      true),
    cage:     buildDeviceAge(siteChange,    t.cageWarnH,   t.cageUrgentH, true),
    iage:     buildDeviceAge(insulinChange, penWarnH,      penUrgentH,    false),
    basalPen: buildDeviceAge(basalChange,   penWarnH,      penUrgentH,    false),
    rapidPen: buildDeviceAge(rapidChange,   penWarnH,      penUrgentH,    false),
  };
}
