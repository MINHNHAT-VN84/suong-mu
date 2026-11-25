// Service worker: chạy offline cơ bản + nhận thông báo đẩy.
const CACHE = 'fogmap-v4';
const SHELL = ['./', 'index.html', 'styles.css', 'js/app.js', 'js/config.js', 'js/geo.js', 'js/fog.js', 'js/store.js', 'js/badges.js', 'js/icons.js',
  'manifest.webmanifest', 'icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
// Mạng trước, mất mạng thì dùng bản lưu (chỉ cho file của app)
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request))
  );
});

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data.json(); } catch { d = { title: 'Thành Phố Sương Mù', body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Thành Phố Sương Mù', {
    body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: d.url || './' },
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || './';
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => {
    for (const c of list) if ('focus' in c) { c.navigate?.(url); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
