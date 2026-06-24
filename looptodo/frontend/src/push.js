import { userId } from './userId.js';

const BASE = `${import.meta.env.VITE_API_URL ?? 'https://stay-with-you-backend.onrender.com'}/api`;
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

// Returns 'on' | 'off' | 'denied' | 'unsupported'
export async function getPushState() {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!reg) return 'off';
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

export async function subscribeToPush() {
  if (!isPushSupported()) throw new Error('unsupported');
  if (!VAPID_PUBLIC_KEY) throw new Error('VITE_VAPID_PUBLIC_KEY is not set — check your .env file');

  // Step 1: request permission
  console.log('[push] requesting notification permission…');
  const permission = await Notification.requestPermission();
  console.log('[push] notification permission:', permission);
  if (permission !== 'granted') throw new Error('denied');

  // Step 2: register service worker and wait until it is active
  console.log('[push] registering service worker…');
  await navigator.serviceWorker.register('/sw.js');
  const readyReg = await navigator.serviceWorker.ready;
  console.log('[push] service worker registered and ready:', readyReg.scope);

  // Step 3: create or reuse push subscription
  console.log('[push] creating PushManager subscription…');
  let sub = await readyReg.pushManager.getSubscription();
  if (!sub) {
    sub = await readyReg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  console.log('[push] push subscription created, endpoint:', sub.endpoint);

  // Step 4: save subscription to backend
  console.log('[push] sending subscription to backend…');
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
    const msg = body.error || `Server error ${res.status}`;
    console.error('[push] subscribe API failed:', msg);
    throw new Error(msg);
  }

  const data = await res.json();
  console.log('[push] subscribe API success:', data);
  return sub;
}

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
  }).catch((err) => console.warn('[push] unsubscribe API call failed (best-effort):', err.message));
}

export async function sendTestNotification() {
  console.log('[push] sending test notification for userId:', userId);
  const res = await fetch(`${BASE}/push/test`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body.error || `HTTP ${res.status}`;
    console.error('[push] test API failed:', msg);
    throw new Error(msg);
  }
  const data = await res.json();
  console.log('[push] test API response:', data);
  return data;
}
