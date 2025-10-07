const CACHE = 'meal-pwa-v1';
const ASSETS = [
  '/', '/index.html', '/styles.css', '/app.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png', '/icons/icon-512.png',
  '/data/normalized.csv' // Yol B için; Yol A kullanıyorsan bu olmayabilir
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{ e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  // CSV (Google veya yerel) için network-first, fallback cache
  if (url.pathname.endsWith('.csv') || url.searchParams.get('output')==='csv'){
    e.respondWith((async ()=>{
      try {
        const fresh = await fetch(e.request);
        const cache = await caches.open(CACHE);
        cache.put(e.request, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(e.request);
        if (cached) return cached;
        throw new Error('offline and no cache');
      }
    })());
    return;
  }
  // Diğerleri: cache-first
  e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request)));
});
