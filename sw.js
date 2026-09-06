/* ============================================================
   PORCH FAMILY — Service Worker
   Handles: real Web Push events, notification taps (deep link),
   and an offline shell so the app opens without a connection.
   ============================================================ */
const CACHE = 'porch-v1';
const SHELL = ['./', './index.html', './support.js', './pf-icons.js', './ds-styles.css'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(()=>{})));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ---- REAL PUSH: fired by a push service when your backend sends one ---- */
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (err) { data = { body: event.data && event.data.text() }; }

  const title = data.title || 'Porch Family Weekend';
  const opts = {
    body:  data.body || '',
    icon:  data.icon || 'sprites/freddie_face.png',
    badge: 'sprites/freddie_face.png',
    tag:   data.tag || 'porch-general',       // same tag replaces instead of stacking
    renotify: true,
    vibrate: [120, 60, 120],
    requireInteraction: false,
    data: { url: data.url || './index.html?screen=home' }
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

/* ---- TAP: focus an open tab and route it, or open a new one ---- */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './index.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) {
          c.postMessage({ type: 'PORCH_NAV', url: target });   // route the live app
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});

/* ---- let the page ask the SW to show a notification (no backend needed) ---- */
self.addEventListener('message', event => {
  const d = event.data || {};
  if (d.type === 'PORCH_NOTIFY') {
    self.registration.showNotification(d.title || 'Porch Family Weekend', {
      body: d.body || '',
      icon: 'sprites/freddie_face.png',
      badge: 'sprites/freddie_face.png',
      tag: d.tag || 'porch-local',
      renotify: true,
      vibrate: [120, 60, 120],
      data: { url: d.url || './index.html' }
    });
  }
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then(r => r || caches.match('./index.html')))
  );
});
