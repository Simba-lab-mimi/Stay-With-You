import { userId } from './userId.js';

// Push always targets the Render backend (where VAPID keys + push_subscriptions live).
// VITE_PUSH_API_URL lets you override; falls back to VITE_API_URL, then the Render default.
const BASE = `${
  import.meta.env.VITE_PUSH_API_URL ??
  import.meta.env.VITE_API_URL ??
  'https://stay-with-you-backend.onrender.com'
}/api`;
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// POST subscription to backend — throws with server message on failure.
async function syncToBackend(sub) {
  const res = await fetch(`${BASE}/push/subscribe`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      userId,
      subscription: sub.toJSON(),
      timezone:     Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Server error ${res.status}`);
  }
  return res.json();
}

// GET /api/push/status — returns activeSubscriptions count.
async function getBackendStatus() {
  try {
    const res = await fetch(`${BASE}/push/status?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return { activeSubscriptions: 0 };
    return await res.json();
  } catch {
    return { activeSubscriptions: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getPushState — verifies all four conditions before returning 'on':
//   1. Notification.permission === 'granted'
//   2. Service worker exists and is active
//   3. Browser has a live PushManager subscription
//   4. Backend confirms activeSubscriptions > 0
//
// If 1–3 are met but backend has 0, silently re-syncs browser sub to backend.
// ─────────────────────────────────────────────────────────────────────────────
export async function getPushState() {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'off';

  try {
    // Condition 2: SW active
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!reg?.active) return 'off';

    // Condition 3: browser has a push subscription
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return 'off';

    // Condition 4: backend has it
    const status = await getBackendStatus();
    if (status.activeSubscriptions > 0) return 'on';

    // Backend lost it — re-sync silently
    console.log('[push] getPushState: backend has 0 active subs, re-syncing…');
    try {
      await syncToBackend(sub);
      console.log('[push] getPushState: re-sync OK');
      const confirmed = await getBackendStatus();
      return confirmed.activeSubscriptions > 0 ? 'on' : 'off';
    } catch (err) {
      console.warn('[push] getPushState: re-sync failed:', err.message);
      return 'off';
    }
  } catch {
    return 'off';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// subscribeToPush — always creates a completely fresh subscription.
//
// Never reuses a stale browser endpoint. The old "reuse" path was the source
// of 410 Gone failures: Chrome keeps returning a dead subscription from
// getSubscription() even after the FCM endpoint has expired.
//
// Steps:
//   1. Request permission
//   2. Remove any existing browser push subscription
//   3. Unregister the old service worker
//   4. Register a fresh service worker, wait until active
//   5. Create a fresh PushManager subscription (new FCM endpoint from Chrome)
//   6. POST to backend — must return 200 before showing success
//   7. GET /status to confirm backend has it
//
// onProgress(msg) is called at key steps for live UI feedback.
// ─────────────────────────────────────────────────────────────────────────────
export async function subscribeToPush(onProgress) {
  if (!isPushSupported()) throw new Error('unsupported');
  if (!VAPID_PUBLIC_KEY) throw new Error('VITE_VAPID_PUBLIC_KEY is not set — check your .env file');

  // Step 1: permission (must be synchronous from user gesture)
  console.log('[push] step 1 — requesting notification permission…');
  onProgress?.('Requesting permission…');
  const permission = await Notification.requestPermission();
  console.log('[push] permission result:', permission);
  if (permission !== 'granted') throw new Error('denied');

  // Step 2 + 3: tear down stale browser sub and old SW
  console.log('[push] step 2 — cleaning up stale subscription and service worker…');
  onProgress?.('Preparing reminders…');

  const existingReg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (existingReg) {
    const existingSub = await existingReg.pushManager.getSubscription();
    if (existingSub) {
      await existingSub.unsubscribe();
      console.log('[push] removed stale browser push subscription');
    }
    await existingReg.unregister();
    console.log('[push] unregistered old service worker');
  } else {
    console.log('[push] no existing service worker found');
  }

  // Step 4: fresh SW registration + wait until active
  console.log('[push] step 3 — registering fresh service worker…');
  await navigator.serviceWorker.register('/sw.js');
  const readyReg = await navigator.serviceWorker.ready;
  console.log('[push] service worker active, scope:', readyReg.scope);

  // Step 5: fresh browser push subscription (new FCM endpoint)
  console.log('[push] step 4 — creating fresh PushManager subscription…');
  const sub = await readyReg.pushManager.subscribe({
    userVisibleOnly:      true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  console.log('[push] new push endpoint:', sub.endpoint);

  // Step 6: POST to backend — no success until this returns 200
  console.log('[push] step 5 — posting subscription to backend…');
  onProgress?.('Syncing subscription…');
  const data = await syncToBackend(sub);
  console.log('[push] backend subscribe success:', data);

  // Step 7: confirm backend has it
  console.log('[push] step 6 — verifying backend status…');
  const status = await getBackendStatus();
  console.log('[push] backend active subscriptions:', status.activeSubscriptions);
  if (status.activeSubscriptions === 0) {
    throw new Error('Subscription saved but backend status returned 0 — please try again');
  }

  console.log('[push] subscribe complete ✓');
  return sub;
}

// ─────────────────────────────────────────────────────────────────────────────
// sendTestNotification — syncs browser sub to backend FIRST, then fires test.
//
// This prevents the "sent:1 but no notification" failure caused by the backend
// having a stale endpoint that the browser already replaced.
// ─────────────────────────────────────────────────────────────────────────────
export async function sendTestNotification(onProgress) {
  console.log('[push] sendTestNotification — userId:', userId);

  // Step 1: verify browser has a subscription
  onProgress?.('Syncing subscription…');
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const sub = reg ? await reg.pushManager.getSubscription() : null;

  if (!sub) {
    console.error('[push] test aborted — no browser subscription found');
    throw new Error('No browser subscription — please re-enable reminders first');
  }
  console.log('[push] browser subscription endpoint:', sub.endpoint);

  // Step 2: sync to backend so it has the current endpoint
  console.log('[push] syncing current subscription to backend before test…');
  await syncToBackend(sub);
  console.log('[push] sync OK');

  // Step 3: call /api/push/test
  onProgress?.('Sending test…');
  console.log('[push] calling /api/push/test…');
  const res = await fetch(`${BASE}/push/test`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ userId }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg  = body.error || `HTTP ${res.status}`;
    console.error('[push] /api/push/test failed:', msg);
    throw new Error(msg);
  }

  const result = await res.json();
  console.log('[push] /api/push/test response:', result);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// unsubscribeFromPush
// ─────────────────────────────────────────────────────────────────────────────
export async function unsubscribeFromPush() {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  console.log('[push] browser subscription removed');

  await fetch(`${BASE}/push/unsubscribe`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ userId, endpoint }),
  }).catch(err => console.warn('[push] unsubscribe API call failed (best-effort):', err.message));
}
