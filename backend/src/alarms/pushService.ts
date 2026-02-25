// ============================================================================
// pushService — Web Push notifications via VAPID (web-push package)
// ============================================================================

import webpush from 'web-push';
import { getSubscriptions, removeSubscription } from './subscriptionStore.js';
import type { AlarmEvent } from './types.js';

let initialized = false;

/** Call once at server startup to configure VAPID credentials. */
export function initWebPush(): void {
  const publicKey  = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const contact    = process.env.VAPID_CONTACT ?? 'mailto:admin@localhost';

  if (!publicKey || !privateKey) {
    console.warn('⚠️  VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — Web Push disabled');
    return;
  }

  webpush.setVapidDetails(contact, publicKey, privateKey);
  initialized = true;
  console.log('🔔 Web Push initialized (VAPID configured)');
}

/** Sends an alarm to all registered push subscriptions. */
export async function broadcastAlarm(event: AlarmEvent, apiUrl: string): Promise<void> {
  if (!initialized) return;

  const subscriptions = await getSubscriptions();
  if (subscriptions.length === 0) return;

  const isUrgent = event.level === 'urgent';
  const title = isUrgent ? '🚨 Nightscout — Urgente' : '⚠️ Nightscout — Aviso';

  const payload = JSON.stringify({
    title,
    body:   event.message,
    type:   event.type,
    level:  event.level,
    apiUrl,
  });

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(sub as webpush.PushSubscription, payload)
    )
  );

  // Remove expired/invalid subscriptions (410 Gone or 404 Not Found)
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'rejected') {
      const err = result.reason as { statusCode?: number };
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        const endpoint = subscriptions[i].endpoint;
        if (endpoint) {
          console.log(`🗑  Removing expired push subscription: ${endpoint.slice(0, 60)}…`);
          await removeSubscription(endpoint);
        }
      } else {
        console.warn('⚠️  Push notification failed:', err);
      }
    }
  }
}
