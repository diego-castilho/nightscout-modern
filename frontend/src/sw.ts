/// <reference lib="webworker" />
// ============================================================================
// Custom Service Worker — precaching (Workbox) + Web Push alarms
// ============================================================================

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope;

// NotificationOptions extended with Push API fields not yet in TypeScript's lib
interface PushNotificationOptions extends NotificationOptions {
  renotify?: boolean;
  vibrate?:  number[];
  actions?:  Array<{ action: string; title: string; icon?: string }>;
}

// ── Workbox precaching (mirrors the original generateSW behaviour) ────────────
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Force the new SW to activate immediately instead of waiting for old tabs to close.
// Without this, navigator.serviceWorker.ready never resolves with the new SW.
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });

// ── Runtime caching for API calls — NetworkFirst, 5-min cache ────────────────
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5,
  })
);

// ── Push notification handler ─────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  interface PushPayload {
    title:   string;
    body:    string;
    type:    string;
    level:   'urgent' | 'warning';
    apiUrl?: string;
  }

  const data = event.data.json() as PushPayload;
  const isUrgent = data.level === 'urgent';

  event.waitUntil(
    self.registration.pushManager.getSubscription().then((sub) =>
      self.registration.showNotification(data.title, {
        body:     data.body,
        icon:     '/pwa-192x192.png',
        badge:    '/pwa-192x192.png',
        tag:      data.type,    // deduplicates same-type alarms
        renotify: true,
        vibrate:  isUrgent ? [300, 100, 300, 100, 300] : [200, 100, 200],
        data: {
          alarmType:            data.type,
          apiUrl:               data.apiUrl ?? '',
          subscriptionEndpoint: sub?.endpoint ?? '',
        },
        actions: [
          { action: 'snooze',  title: 'Snooze 30 min' },
          { action: 'dismiss', title: 'Fechar' },
        ],
      } as PushNotificationOptions)
    )
  );
});

// ── Notification click handler ────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { alarmType, apiUrl, subscriptionEndpoint } =
    (event.notification.data ?? {}) as {
      alarmType?: string;
      apiUrl?: string;
      subscriptionEndpoint?: string;
    };

  if (event.action === 'snooze' && apiUrl && subscriptionEndpoint) {
    event.waitUntil(
      fetch(`${apiUrl}/push/snooze`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          subscriptionEndpoint,
          alarmType,
          durationMinutes: 30,
        }),
      }).catch(() => {/* ignore network errors */})
    );
  } else if (event.action !== 'dismiss') {
    // Open (or focus) the app
    event.waitUntil(
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          for (const client of clientList) {
            if ('focus' in client) return (client as WindowClient).focus();
          }
          return self.clients.openWindow('/');
        })
    );
  }
});
