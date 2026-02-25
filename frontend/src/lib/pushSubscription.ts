// ============================================================================
// Push Subscription — browser-side Web Push helpers
// ============================================================================

/**
 * Convert a base64url string (VAPID public key) to Uint8Array
 * required by PushManager.subscribe({ applicationServerKey }).
 */
function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const buffer  = new ArrayBuffer(rawData.length);
  const view    = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) {
    view[i] = rawData.charCodeAt(i);
  }
  return buffer;
}

/** Returns the current push subscription for this browser, or null. */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/**
 * Request push permission and subscribe.
 * Throws if permission is denied or SW / Push not supported.
 */
export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscription> {
  if (!('serviceWorker' in navigator)) throw new Error('Service Worker não suportado.');
  if (!('PushManager' in window))      throw new Error('Web Push não suportado neste browser.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permissão de notificação negada.');

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing; // already subscribed — return as-is

  return reg.pushManager.subscribe({
    userVisibleOnly:      true,
    applicationServerKey: urlBase64ToArrayBuffer(vapidPublicKey),
  });
}

/** Unsubscribe this browser from push notifications. */
export async function unsubscribeFromPush(): Promise<void> {
  const sub = await getCurrentSubscription();
  if (sub) await sub.unsubscribe();
}
