// BloomWorld Service Worker: macht das Spiel installierbar und startet es auch bei schlechter Verbindung.
// Netz zuerst (damit Updates sofort ankommen), Cache nur als Ersatz. Server-Anfragen (/api/) werden nie gecacht.
const CACHE = 'bw-v3.4';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/index.html', '/manifest.webmanifest']).catch(() => {}))); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {}); } return r; }).catch(() => caches.match(e.request).then((m) => m || (e.request.mode === 'navigate' ? caches.match('/index.html') : undefined))));
});
