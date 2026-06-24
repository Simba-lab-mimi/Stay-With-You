self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch { /* ignore malformed */ }

  const title   = data.title ?? 'Stay With You 💙';
  const options = {
    body:               data.body ?? 'You have tasks waiting for you today.',
    icon:               '/icon-192.png',
    badge:              '/icon-192.png',
    data:               { url: data.url ?? '/' },
    requireInteraction: false,
    tag:                'daily-reminder',   // replaces any previous daily-reminder notification
    renotify:           false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Try to focus an existing app window
        for (const client of windowClients) {
          if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // No open window — open a new one
        if (clients.openWindow) return clients.openWindow(targetUrl);
      })
  );
});
