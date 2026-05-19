const CACHE_NAME = 'shadowhack-shell-v5';
const APP_SHELL = ['/', '/play', '/manifest.webmanifest', '/icons/icon.svg'];
const OFFLINE_FALLBACK = '/play';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached ?? caches.match(OFFLINE_FALLBACK) ?? caches.match('/'))),
  );
});

self.addEventListener('push', (event) => {
  const payload = readPushPayload(event);
  const notification = payload.notification ?? payload;
  const title = notification.title ?? 'shadowHack';
  const options = {
    body: notification.body ?? payload.body ?? 'Nuevo mensaje del host.',
    icon: notification.icon ?? '/icons/icon.svg',
    badge: notification.badge ?? '/icons/icon.svg',
    data: payload.data ?? payload,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const visibleClient = clients.find((client) => 'focus' in client);
        if (visibleClient) return visibleClient.focus();
        if (self.clients.openWindow) return self.clients.openWindow('/play');
        return undefined;
      }),
  );
});

function readPushPayload(event) {
  try {
    return event.data?.json() ?? {};
  } catch (error) {
    return { notification: { title: 'shadowHack', body: event.data?.text() ?? 'Nuevo mensaje.' } };
  }
}
