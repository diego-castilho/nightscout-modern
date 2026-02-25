// ============================================================================
// Alarm Evaluator — pure function, no side effects
// Checks the latest glucose reading against thresholds and returns the list
// of alarm events that should fire (respecting snooze state and config).
// ============================================================================

import type { GlucoseEntry } from '../types/index.js';
import type { AlarmConfig, AlarmEvent, AlarmThresholds, AlarmType } from './types.js';

// AR2 constants (same as frontend) — used for predictive check (6 steps = 30 min)
const BG_REF  = 140;
const BG_MIN  = 36;
const AR_COEF = [-0.723, 1.716] as const;
const BUCKET_OFFSET_MS = 2.5 * 60_000;
const BUCKET_SIZE_MS   = 5.0 * 60_000;

/** Returns AR2 predicted values for the next `steps` × 5 min. */
function ar2Predict(entries: GlucoseEntry[], steps = 6): number[] {
  if (entries.length < 2) return [];
  const sorted = [...entries].sort((a, b) => b.date - a.date);
  const latest = sorted[0];

  const recentBucket = sorted.filter(
    (e) => Math.abs(e.date - latest.date) <= BUCKET_OFFSET_MS
  );
  const prevBucket = sorted.filter(
    (e) =>
      e.date < latest.date - BUCKET_OFFSET_MS &&
      e.date >= latest.date - BUCKET_OFFSET_MS - BUCKET_SIZE_MS
  );

  if (!recentBucket.length || !prevBucket.length) return [];

  const mean = (arr: GlucoseEntry[]) => arr.reduce((s, e) => s + e.sgv, 0) / arr.length;
  const s0 = mean(recentBucket);
  const s1 = mean(prevBucket);
  if (s0 < BG_MIN || s1 < BG_MIN) return [];

  let prev = Math.log(s1 / BG_REF);
  let curr = Math.log(s0 / BG_REF);
  const predictions: number[] = [];

  for (let i = 0; i < steps; i++) {
    const nextCurr = AR_COEF[0] * prev + AR_COEF[1] * curr;
    predictions.push(Math.max(BG_MIN, Math.round(BG_REF * Math.exp(nextCurr))));
    prev = curr;
    curr = nextCurr;
  }
  return predictions;
}

/** Main evaluation function — returns 0 or more AlarmEvents. */
export function evaluateAlarms(
  latest: GlucoseEntry,
  recentEntries: GlucoseEntry[],
  thresholds: AlarmThresholds,
  config: AlarmConfig,
  snoozeState: Map<AlarmType, number>,
): AlarmEvent[] {
  if (!config.enabled) return [];

  const now = Date.now();
  const sgv = latest.sgv;
  const dir = latest.direction ?? '';

  /** Returns true if the alarm type is enabled AND not snoozed. */
  function canFire(type: AlarmType, enabled: boolean): boolean {
    if (!enabled) return false;
    const snoozeUntil = snoozeState.get(type) ?? 0;
    return snoozeUntil <= now;
  }

  const events: AlarmEvent[] = [];

  // ── 1. VERY_LOW ─────────────────────────────────────────────────────────────
  if (canFire('VERY_LOW', config.veryLow) && sgv <= thresholds.veryLow) {
    events.push({ type: 'VERY_LOW', level: 'urgent', sgv,
      message: `🚨 Glicose muito baixa: ${sgv} mg/dL`, timestamp: now });
  }

  // ── 2. LOW ────────────────────────────────────────────────────────────────
  if (canFire('LOW', config.low) && sgv > thresholds.veryLow && sgv <= thresholds.low) {
    events.push({ type: 'LOW', level: 'warning', sgv,
      message: `⚠️ Glicose baixa: ${sgv} mg/dL`, timestamp: now });
  }

  // ── 3. HIGH ───────────────────────────────────────────────────────────────
  if (canFire('HIGH', config.high) && sgv >= thresholds.high && sgv < thresholds.veryHigh) {
    events.push({ type: 'HIGH', level: 'warning', sgv,
      message: `⚠️ Glicose alta: ${sgv} mg/dL`, timestamp: now });
  }

  // ── 4. VERY_HIGH ──────────────────────────────────────────────────────────
  if (canFire('VERY_HIGH', config.veryHigh) && sgv >= thresholds.veryHigh) {
    events.push({ type: 'VERY_HIGH', level: 'urgent', sgv,
      message: `🚨 Glicose muito alta: ${sgv} mg/dL`, timestamp: now });
  }

  // ── 5. RAPID_FALL ─────────────────────────────────────────────────────────
  if (canFire('RAPID_FALL', config.rapidChange) && dir === 'DoubleDown') {
    events.push({ type: 'RAPID_FALL', level: 'urgent', sgv,
      message: `🚨 Queda rápida: ${sgv} mg/dL ↓↓`, timestamp: now });
  }

  // ── 6. RAPID_RISE ────────────────────────────────────────────────────────
  if (canFire('RAPID_RISE', config.rapidChange) && dir === 'DoubleUp') {
    events.push({ type: 'RAPID_RISE', level: 'warning', sgv,
      message: `⚠️ Subida rápida: ${sgv} mg/dL ↑↑`, timestamp: now });
  }

  // ── 7. PREDICTED_LOW / PREDICTED_HIGH ────────────────────────────────────
  if (config.predictive) {
    const preds = ar2Predict(recentEntries, 6);
    if (preds.length > 0) {
      const minPred = Math.min(...preds);
      const maxPred = Math.max(...preds);

      if (canFire('PREDICTED_LOW', true) && minPred <= thresholds.veryLow) {
        events.push({ type: 'PREDICTED_LOW', level: 'urgent', sgv,
          message: `🚨 Previsão: glicose muito baixa em 30 min (${minPred} mg/dL)`, timestamp: now });
      } else if (canFire('PREDICTED_LOW', true) && minPred <= thresholds.low) {
        events.push({ type: 'PREDICTED_LOW', level: 'warning', sgv,
          message: `⚠️ Previsão: glicose baixa em 30 min (${minPred} mg/dL)`, timestamp: now });
      }

      if (canFire('PREDICTED_HIGH', true) && maxPred >= thresholds.veryHigh) {
        events.push({ type: 'PREDICTED_HIGH', level: 'urgent', sgv,
          message: `🚨 Previsão: glicose muito alta em 30 min (${maxPred} mg/dL)`, timestamp: now });
      } else if (canFire('PREDICTED_HIGH', true) && maxPred >= thresholds.high) {
        events.push({ type: 'PREDICTED_HIGH', level: 'warning', sgv,
          message: `⚠️ Previsão: glicose alta em 30 min (${maxPred} mg/dL)`, timestamp: now });
      }
    }
  }

  // ── 8. STALE ──────────────────────────────────────────────────────────────
  if (canFire('STALE', config.stale) &&
      now - latest.date > config.staleMins * 60_000) {
    const mins = Math.floor((now - latest.date) / 60_000);
    events.push({ type: 'STALE', level: 'urgent',
      message: `🚨 Sem leitura há ${mins} min (sensor desconectado?)`, timestamp: now });
  }

  return events;
}
