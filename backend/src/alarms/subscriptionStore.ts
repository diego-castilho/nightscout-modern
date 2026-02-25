// ============================================================================
// subscriptionStore — MongoDB persistence for push subscriptions +
//                     in-memory snooze state
// ============================================================================

import { getDatabase } from '../db/connection.js';
import type { AlarmType } from './types.js';

// Browser PushSubscriptionJSON is a DOM type — redefine for Node context
export interface PushSubscriptionData {
  endpoint:       string;
  keys?:          { p256dh: string; auth: string };
  expirationTime?: number | null;
}

const COLLECTION = 'push_subscriptions';

// ── Push subscriptions (persistent) ─────────────────────────────────────────

export async function saveSubscription(sub: PushSubscriptionData): Promise<void> {
  const db = getDatabase();
  await db.collection(COLLECTION).updateOne(
    { endpoint: sub.endpoint },
    { $set: { ...sub, updatedAt: new Date() } },
    { upsert: true }
  );
}

export async function getSubscriptions(): Promise<PushSubscriptionData[]> {
  const db = getDatabase();
  const docs = await db.collection(COLLECTION).find({}).toArray();
  return docs.map(({ endpoint, keys, expirationTime }) => ({
    endpoint,
    keys,
    expirationTime: expirationTime ?? null,
  })) as PushSubscriptionData[];
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const db = getDatabase();
  await db.collection(COLLECTION).deleteOne({ endpoint });
}

export async function isKnownEndpoint(endpoint: string): Promise<boolean> {
  const db = getDatabase();
  const doc = await db.collection(COLLECTION).findOne({ endpoint });
  return doc !== null;
}

// ── Snooze state (in-memory, resets on server restart — acceptable) ──────────

const snoozeMap = new Map<AlarmType, number>(); // alarmType → snoozedUntilMs

export function setSnooze(type: AlarmType, durationMs: number): void {
  snoozeMap.set(type, Date.now() + durationMs);
}

export function clearSnooze(type: AlarmType): void {
  snoozeMap.delete(type);
}

export function getSnoozeMap(): Map<AlarmType, number> {
  return snoozeMap;
}
