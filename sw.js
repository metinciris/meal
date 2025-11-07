/* sw.js — Safe baseline for /meal/
   - Precache sadece aynı-origin statikler
   - Navigasyon: network-first (+ offline fallback)
   - Apps Script: network-only (SW dokunmaz)
*/

const VERSION = 'v4';
const STATIC_CACHE = `meal-static-${VERSION}`;

// ABSOLUTE yollar (GitHub Pages /meal/ alt yolu için)
const ASSETS = [
  '/meal/',
  '/meal/index.html',
  '/meal/styles.css',
  '/meal/app.js',
  '/meal/manifest.webmanifest',
  '/meal/icons/icon-192.png',
  '/meal/icons/icon-512.png',
  '/meal/icons/maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    // Taze kopya için cache:'reload'
    await cache.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k !== STATIC_CACHE).map(k => caches.delete(k))
    );
    // (isteğe bağlı) navigation preload varsa aç
    try { await self.registration.navigationPreload?.enable(); } catch {}
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // 0) Apps Script → network-only (proxyleme yok, aynen geç)
  // URL içinde /macros/s/ varsa hiç dokunma:
  if (url.href.includes('/macros/s/')) {
    // SW müdahale etmesin diye respondWith kullanmıyoruz (doğrudan tarayıcı fetch'i)
    return;
  }

  // 1) Navigasyon (sayfa geçişi) → network-first + offline fallback
  const isNavigation =
    req.mode === 'navigate' ||
    (req.destination === '' && req.headers.get('accept')?.includes('text/html'));

  if (isNavigation && sameOrigin) {
    event.respondWith((async () => {
      // navigation preload varsa önce onu kullan
      const preload = await event.preloadResponse;
      if (preload) return preload;
      try {
        return await fetch(req);
      } catch {
        const cache = await caches.open(STATIC_CACHE);
        const offline = await cache.match('/meal/index.html');
        return offline || Response.error();
      }
    })());
    return;
  }

  // 2) Aynı-origin statik varlıklar → cache-first
  if (sameOrigin && isPrecachedPath(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const hit = await cache.match(req, { ignoreVary: true });
      if (hit) return hit;
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })());
    return;
  }

  // 3) Diğer her şey → tarayıcıya bırak (SW dokunmaz)
  // event.respondWith(...) çağırmıyoruz ki normal ağ akışı işlensin.
});

// ASSETS listesinde olup olmadığını basitçe kontrol et
function isPrecachedPath(url) {
  const path = url.pathname + url.search;
  return ASSETS.includes(url.pathname) || ASSETS.includes(path) || ASSETS.includes('/meal/');
}
