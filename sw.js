// =============================================================
// Service worker — lets the dashboard open with no connection.
//
// Pages and scripts are fetched from the network first, so a new
// deploy shows up straight away when online; the last good copy
// is kept and served when offline. Requests to Supabase are left
// alone (the pages handle being offline themselves).
// =============================================================
const CACHE = 'dash-v1';
const SHELL = [
  './', 'index.html', 'health.html', 'gym.html', 'uni.html', 'finance.html',
  'topbar.js', 'sync.js', 'sandbox.js', 'manifest.webmanifest',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'
];
const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(SHELL.concat([CDN]).map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (res.ok) await cache.put(url, res);
      } catch (e) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isCdn = url.origin === 'https://cdn.jsdelivr.net';
  if (!sameOrigin && !isCdn) return; // Supabase and anything else: untouched

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (e) {
      // Offline: ignore ?sandbox and similar when looking up a page.
      const hit = await cache.match(req, { ignoreSearch: sameOrigin });
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const home = await cache.match('index.html');
        if (home) return home;
      }
      throw e;
    }
  })());
});
