// ============================================================================
// lib/glucoseDelta.ts — Shared bucket-averaging and delta computation
// ============================================================================
// Both CurrentGlucoseCard (calcNSDelta) and GlucoseAreaChart (calculateAR2)
// use identical 5-min sliding bucket logic to smooth noise before computing
// glucose rate-of-change. This file centralises those shared constants and
// the bucket helper so both consumers stay in sync.
// ============================================================================

import type { GlucoseEntry } from './api';

/** Half-width of each 5-min bucket centred on the reading. */
export const BUCKET_OFFSET_MS = 2.5 * 60_000;

/** Size of each bucket (distance between bucket centres). */
export const BUCKET_SIZE_MS   = 5.0 * 60_000;

/** Returns the recent and previous 5-min buckets around `latest`. */
export function computeBuckets(
  entries: GlucoseEntry[],
  latest: GlucoseEntry,
): { recent: GlucoseEntry[]; prev: GlucoseEntry[] } {
  return {
    recent: entries.filter(
      e => e.date >= latest.date - BUCKET_OFFSET_MS && e.date <= latest.date + BUCKET_OFFSET_MS,
    ),
    prev: entries.filter(
      e => e.date >= latest.date - BUCKET_OFFSET_MS - BUCKET_SIZE_MS &&
           e.date <  latest.date - BUCKET_OFFSET_MS,
    ),
  };
}

/**
 * Mirrors Nightscout bgnow.js calcDelta with bucket averaging.
 * Recent bucket  = [latest − 2.5 min, latest + 2.5 min]
 * Previous bucket = [latest − 7.5 min, latest − 2.5 min]
 * When gap > 9 min between bucket centres, interpolates to a 5-min equivalent.
 */
export function calcNSDelta(latest: GlucoseEntry, entries: GlucoseEntry[]): number | undefined {
  const { recent, prev } = computeBuckets(entries, latest);
  if (!recent.length || !prev.length) return undefined;

  const mean = (arr: GlucoseEntry[]) => arr.reduce((s, e) => s + e.sgv, 0) / arr.length;
  const elapsedMins =
    (Math.max(...recent.map(e => e.date)) - Math.max(...prev.map(e => e.date))) / 60_000;
  const absolute = mean(recent) - mean(prev);

  return elapsedMins > 9
    ? Math.round(absolute / elapsedMins * 5)
    : Math.round(absolute);
}
