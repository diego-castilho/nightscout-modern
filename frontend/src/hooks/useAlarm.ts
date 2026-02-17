// ============================================================================
// useAlarm - Glucose threshold monitoring and audio alarm trigger
// Checks each new reading against configured thresholds.
// Applies a 15-minute cooldown per zone to avoid alarm fatigue.
// ============================================================================

import { useEffect, useRef } from 'react';
import { globalAudioAlarm } from '../lib/audioAlarm';
import type { AlarmPattern } from '../lib/audioAlarm';
import { useDashboardStore } from '../stores/dashboardStore';
import type { GlucoseEntry } from '../lib/api';

const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

interface LastAlarm {
  time: number;
  zone: string;
}

export function useAlarm(
  latest: GlucoseEntry | null,
  onAlarm: (zone: string, sgv: number) => void
): void {
  const { alarmEnabled, alarmThresholds } = useDashboardStore();

  // Persistent refs — do not cause re-renders
  const lastAlarmRef      = useRef<LastAlarm | null>(null);
  // Tracks the last (sgv + thresholds) combination we evaluated,
  // so that changing a threshold triggers re-evaluation of the current reading.
  const lastProcessedKey  = useRef<string | null>(null);

  // Sync AudioContext with alarmEnabled state
  useEffect(() => {
    // Note: enable() must have already been called from a user gesture
    // (the Bell button toggle). Here we only disable when turned off.
    if (!alarmEnabled) {
      globalAudioAlarm.disable();
    }
  }, [alarmEnabled]);

  // Evaluate every new glucose reading
  useEffect(() => {
    if (!alarmEnabled || !latest) return;

    const sgv = latest.sgv;
    const { veryLow, low, high, veryHigh } = alarmThresholds;

    // Skip if this exact (sgv + thresholds) combo was already processed.
    // Including thresholds ensures a threshold change re-triggers evaluation
    // even when the glucose reading hasn't changed yet.
    const processedKey = `${sgv}|${veryLow}-${low}-${high}-${veryHigh}`;
    if (processedKey === lastProcessedKey.current) return;
    lastProcessedKey.current = processedKey;

    // Map SGV to zone and audio pattern
    let zone: string | null = null;
    let pattern: AlarmPattern | null = null;

    if (sgv <= veryLow) {
      zone    = 'urgentLow';
      pattern = 'urgentLow';
    } else if (sgv <= low) {
      zone    = 'low';
      pattern = 'low';
    } else if (sgv >= veryHigh) {
      zone    = 'veryHigh';
      pattern = 'high';
    } else if (sgv >= high) {
      zone    = 'high';
      pattern = 'high';
    }

    if (!zone || !pattern) return; // glucose is within normal range

    // Cooldown: same zone alerted recently?
    const now = Date.now();
    if (
      lastAlarmRef.current?.zone === zone &&
      now - lastAlarmRef.current.time < COOLDOWN_MS
    ) return;

    // Fire alarm
    lastAlarmRef.current = { time: now, zone };
    globalAudioAlarm.playPattern(pattern);
    onAlarm(zone, sgv);

  }, [latest, alarmEnabled, alarmThresholds, onAlarm]);
}

