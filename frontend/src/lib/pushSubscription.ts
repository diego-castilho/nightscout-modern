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
 * Ensures the service worker is registered and active, returning the registration.
 *
 * We call register() explicitly (idempotent — returns existing registration if
 * already registered) instead of relying on vite-pwa's registerSW.js, which runs
 * asynchronously after page load and might not have executed yet.
 *
 * With self.skipWaiting() + clients.claim() in sw.ts, the install→activate
 * transition completes in < 1 second. We wait for it via statechange events so
 * we don't block on navigator.serviceWorker.ready (which requires a controlling
 * SW and can hang after a hard refresh on some browsers).
 */
async function waitForServiceWorker(): Promise<ServiceWorkerRegistration> {
  // Idempotent — returns existing registration or starts a fresh one.
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

  // Common case: SW already active from a previous visit.
  if (reg.active) return reg;

  // SW is in installing/waiting state — wait for it to become active.
  return new Promise<ServiceWorkerRegistration>((resolve, reject) => {
    const tid = setTimeout(
      () => reject(new Error(
        'Service Worker não ativou. Recarregue a página (F5) e tente novamente.'
      )),
      15_000,
    );

    const sw = reg.installing ?? reg.waiting;
    if (!sw) {
      // No transitioning SW and no active SW — unusual state, use ready as fallback.
      navigator.serviceWorker.ready.then(() => { clearTimeout(tid); resolve(reg); });
      return;
    }

    sw.addEventListener('statechange', function listen() {
      if (sw.state === 'activated') {
        clearTimeout(tid);
        sw.removeEventListener('statechange', listen);
        resolve(reg);
      } else if (sw.state === 'redundant') {
        clearTimeout(tid);
        sw.removeEventListener('statechange', listen);
        reject(new Error('Service Worker falhou ao instalar. Recarregue a página.'));
      }
    });
  });
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
