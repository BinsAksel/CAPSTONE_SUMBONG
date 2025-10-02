/* Rich service worker with build-based versioning & network-first navigation
 * Strategy summary:
 *  - Each deploy registers sw.js?build=<BUILD_ID>, forcing a new SW install.
 *  - Navigation requests (HTML) use network-first; offline fallback to cached index.html.
 *  - Static assets (script/style/font) use stale-while-revalidate.
 *  - Other requests pass through (let browser handle; APIs shouldn't be cached here).
 */

const BUILD_ID = new URL(self.location).searchParams.get('build') || 'dev';
const CORE_CACHE = `sumbong-core-${BUILD_ID}`;
const RUNTIME_CACHE = `sumbong-runtime-${BUILD_ID}`;
const CORE_ASSETS = ['/index.html','/manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CORE_CACHE)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(k => (k.startsWith('sumbong-core-') || k.startsWith('sumbong-runtime-')) && !k.endsWith(BUILD_ID))
            .map(k => caches.delete(k))
      );
      await self.clients.claim();
      const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
      clients.forEach(c => c.postMessage({ type: 'SW_ACTIVATED', buildId: BUILD_ID }));
    })()
  );
});

// Support manual immediate activation
self.addEventListener('message', evt => {
  if (evt.data && evt.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isHtmlRequest(req) {
  if (req.mode === 'navigate') return true;
  const accept = req.headers.get('accept') || '';
  return accept.includes('text/html');
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return; // ignore non-GET

  // HTML / navigation: network-first
  if (isHtmlRequest(req)) {
    event.respondWith(
      (async () => {
        try {
          const netResp = await fetch(req, { cache: 'no-store' });
          // Update core cache with fresh index.html only
          if (netResp.ok && req.url.endsWith('/index.html')) {
            const cache = await caches.open(CORE_CACHE);
            cache.put('/index.html', netResp.clone());
          }
          return netResp;
        } catch (e) {
          const cache = await caches.open(CORE_CACHE);
            const cached = await cache.match('/index.html');
          return cached || new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } });
        }
      })()
    );
    return;
  }

  // Static assets: stale-while-revalidate (same-origin only)
  const sameOrigin = req.url.startsWith(self.location.origin);
  const dest = req.destination;
  if (sameOrigin && ['script','style','font','worker'].includes(dest)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(req);
        const fetchPromise = fetch(req).then(resp => {
          if (resp.ok) cache.put(req, resp.clone());
          return resp;
        }).catch(() => cached);
        return cached || fetchPromise;
      })()
    );
    return;
  }
  // Let other requests (images, API, etc.) go straight to network / browser heuristics
});
