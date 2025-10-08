/* sw.js — cache-first assets, network-first API */
const CACHE = 'meal-v1';
const ASSETS = [
  './', './index.html', './styles.css', './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Apps Script API → network-first
  if (url.href.includes('/macros/s/')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  // Diğer her şey → cache-first
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
