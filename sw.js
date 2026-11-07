// AI News service worker — ऐप-शेल ऑफ़लाइन, ख़बरें network-first, फ़ोटो cache
const V = 'ainews-v1';
const SHELL = ['./', './index.html', './style.css', './app.js', './admin.js', './config.js', './manifest.json', './icons/icon-192.png', './icons/icon-512.png', './icons/placeholder.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V && x !== 'ainews-img').map(x => caches.delete(x))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  if (u.pathname.includes('/data/') || u.hostname.includes('github.com') || u.hostname.includes('youtube')) return; // live डेटा — app.js ख़ुद cache करता है
  if (r.destination === 'image') {
    e.respondWith(caches.open('ainews-img').then(async c => {
      const hit = await c.match(r); if (hit) return hit;
      try { const res = await fetch(r); if (res.ok || res.type === 'opaque') { c.put(r, res.clone()); c.keys().then(k => k.length > 200 && c.delete(k[0])); } return res; }
      catch { return caches.match('./icons/placeholder.svg'); }
    })); return;
  }
  e.respondWith(fetch(r).then(res => { if (res.ok && u.origin === location.origin) caches.open(V).then(c => c.put(r, res.clone())); return res; })
    .catch(() => caches.match(r).then(m => m || caches.match('./index.html'))));
});
