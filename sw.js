/* sw.js — PWA for /meal/ (GitHub Pages)
   - Precache: cache-first for statik varlıklar
   - Runtime: navigate → network-first (offline fallback),
              API (Apps Script) → network-first (cache fallback),
              diğer same-origin GET → stale-while-revalidate
*/

const VERSION = 'v3';
const STATIC_CACHE = `meal-static-${VERSION}`;
const RUNTIME_CACHE = 'meal-runtime';

// GitHub Pages alt yolu için ABSOLUTE asset listesi
const ASSETS = [
  '/meal/', // önemli: navigate fallback için de kullanacağız
  '/meal/index.html',
  '/meal/styles.css',
  '/meal/app.js',
  '/meal/manifest.webmanifest',
  '/meal/icons/icon-192.png',
  '/meal/icons/icon-512.png',
  '/meal/icons/maskable-512.png'
];

// Yardımcılar
const isGET = (req) => req.method === 'GET';
const sameOrigin = (url) => url.origin === self.location.origin;
const isAppScript = (url) => url.href.includes('/macros/s/');
const isNavigation = (req) => req.mode === 'navigate' || (req.destination === '' && req.headers.get('accept')?.includes('text/html'));
const toPath = (url) => url.pathname + url.search;

// Precache
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // cache:'reload' ile taze kopya iste
      await cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })));
    })()
  );
  self.skipWaiting();
});

// Eski cache'leri temizle + navigation preload (varsa) aç
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      );

      if (self.registration.navigationPreload) {
        try { await self.registration.navigationPreload.enable(); } catch (_) {}
      }
      await self.clients.claim();
    })()
  );
});

// Genel fetch stratejileri
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Sadece GET istekleri ele alınır
  if (!isGET(req)) return;

  const url = new URL(req.url);

  // 1) Apps Script API → network-first (cache fallback)
  if (isAppScript(url)) {
    event.respondWith(networkFirst(req, RUNTIME_CACHE));
    return;
  }

  // 2) Navigasyon (sayfa geçişleri) → network-first, offline'da index.html
  if (isNavigation(req) && sameOrigin(url)) {
    event.respondWith(pageRequest(req));
    return;
  }

  // 3) Statik önbelleğe alınan varlıklar → cache-first
  if (sameOrigin(url) && isPrecached(url)) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // 4) Same-origin diğer GET istekleri → stale-while-revalidate
  if (sameOrigin(url)) {
    event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
    return;
  }

  // 5) Cross-origin (CDN vs.) → basit network-first (cache fallback yok)
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});

// ---- Strateji yardımcıları ----

function isPrecached(url) {
  // pathname bazlı karşılaştırma (query string'ler için de ana yolları yakala)
  const path = url.pathname.endsWith('/') ? url.pathname : url.pathname;
  return ASSETS.includes(path) || ASSETS.includes(path.replace(/\/+$/, '')) || ASSETS.includes(toPath(url));
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;
  const res = await fetch(request);
  if (res && res.ok) cache.put(request, res.clone());
  return res;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res && (res.ok || res.type === 'opaqueredirect' || res.type === 'opaque')) {
      cache.put(request, res.clone());
    }
    return res;
  } catch (err) {
    const cached = await cache.match(request, { ignoreVary: true });
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedPromise = cache.match(request, { ignoreVary: true });
  const fetchPromise = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);

  const cached = await cachedPromise;
  if (cached) return cached;

  const fresh = await fetchPromise;
  if (fresh) return fresh;

  // Son çare: precache'de varsa dene
  const precached = await caches.open(STATIC_CACHE).then((c) => c.match(request));
  if (precached) return precached;

  // Hiçbiri yoksa olduğu gibi hata fırlasın
  return fetch(request);
}

async function pageRequest(request) {
  // Navigation preload varsa önce onu kullan
  const preload = await eventPreloadResponse();
  if (preload) return preload;

  try {
    const res = await fetch(request);
    return res;
  } catch (err) {
    // Offline → index.html fallback (SPA yönlendirmeleri için)
    const cache = await caches.open(STATIC_CACHE);
    const fallback = await cache.match('/meal/index.html');
    if (fallback) return fallback;
    throw err;
  }
}

// navigation preload yanıtını al
async function eventPreloadResponse() {
  // event.preloadResponse sadece fetch event'inde mevcut; closure ile erişemiyorsak null dön
  try { return await self.registration.navigationPreload?.getState() ? await (self).preloadResponse : null; }
  catch { return null; }
}

// İsteğe bağlı: hemen güncelle (skipWaiting) mesajını destekle
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
