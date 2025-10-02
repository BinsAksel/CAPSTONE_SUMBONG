/* Basic service worker for Sumbong PWA */
const CACHE_NAME = 'sumbong-shell-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // only cache GET
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(resp => {
        if (!resp || !resp.ok) {
          // network error or non-OK status -> attempt offline fallback for navigation
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return resp; // may be undefined; caller handles
        }
        const copy = resp.clone();
        // Only cache same-origin basic successful responses
        if (request.url.startsWith(self.location.origin) && resp.type === 'basic') {
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return resp;
      }).catch(() => {
        // Offline fallback (could be improved with custom offline page)
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
