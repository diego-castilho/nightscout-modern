// ============================================================================
// treatmentsCache — shared module-level cache for treatment fetches
// ============================================================================
// Both useIOB and useCOB need treatments from the last few hours. Without
// this cache they fire two identical requests every 60 s in parallel. The
// cache deduplicates concurrent fetches (inflight promise) and reuses results
// within the TTL window. It auto-invalidates when lastRefresh changes (i.e.
// after a new treatment is saved via the careportal).
// ============================================================================

import { getTreatments } from './api';
import type { Treatment } from './api';

// Cover the larger of the two windows: COB uses 8 h, IOB uses dia (≤ 8 h).
const CACHE_WINDOW_HOURS = 8;

// Slightly shorter than the 60 s poll interval so each tick gets fresh data.
const CACHE_TTL_MS = 55_000;

interface CacheEntry {
  treatments: Treatment[];
  expiresAt: number;
}

let cache: CacheEntry | null = null;
let inflight: Promise<Treatment[]> | null = null;
let lastRefreshSeen: number | undefined = undefined;

/**
 * Returns treatments for the last CACHE_WINDOW_HOURS hours.
 *
 * Pass the current `lastRefresh` value from dashboardStore so the cache
 * auto-invalidates when new treatments are saved.
 */
export async function getCachedTreatments(lastRefresh?: number): Promise<Treatment[]> {
  // Invalidate when lastRefresh changes (new treatment saved).
  if (lastRefresh !== undefined && lastRefresh !== lastRefreshSeen) {
    cache = null;
    lastRefreshSeen = lastRefresh;
  }

  const now = Date.now();

  if (cache && cache.expiresAt > now) {
    return cache.treatments;
  }

  // Deduplicate concurrent requests: return existing inflight promise if any.
  if (inflight) {
    return inflight;
  }

  const startDate = new Date(now - CACHE_WINDOW_HOURS * 3_600_000).toISOString();
  const endDate   = new Date(now).toISOString();

  inflight = getTreatments({ startDate, endDate, limit: 200 })
    .then((treatments) => {
      cache    = { treatments: treatments ?? [], expiresAt: Date.now() + CACHE_TTL_MS };
      inflight = null;
      return cache.treatments;
    })
    .catch((err: unknown) => {
      inflight = null;
      throw err;
    });

  return inflight;
}
