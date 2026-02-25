// ============================================================================
// Push Subscription — browser-side Web Push helpers
// ============================================================================

/**
 * Convert a base64url string (VAPID public key) to ArrayBuffer
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

/**
 * Waits for the service worker to be active, with a 15-second timeout.
 * Throws a descriptive error if the SW never activates.
 */
async function waitForServiceWorker(): Promise<ServiceWorkerRegistration> {
  const timeoutMs = 15_000;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(
          'Service Worker não iniciou a tempo. ' +
          'Verifique se o site está sendo acessado via HTTPS ou localhost, ' +
          'e recarregue a página.'
        )),
        timeoutMs
      )
    ),
  ]);
}

/** Returns the current push subscription for this browser, or null. */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  try {
    const reg = await waitForServiceWorker();
    return reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/**
 * Subscribe to push notifications.
 * permissionGranted: pass true if Notification.requestPermission() was already
 * called outside this function (required for Safari's user-gesture restrictions).
 */
export async function subscribeToPush(
  vapidPublicKey: string,
  permissionGranted = false,
): Promise<PushSubscription> {
  if (!('serviceWorker' in navigator)) throw new Error('Service Worker não suportado neste browser.');
  if (!('PushManager' in window))      throw new Error('Web Push não suportado neste browser.');

  // Request permission only if not already granted externally
  if (!permissionGranted) {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Permissão de notificação negada pelo usuário.');
  }

  const reg      = await waitForServiceWorker();
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
