/**
 * FluentFlow Service Worker
 * Strategy: Network-first with Cache API fallback for offline mode.
 * Only JSON data files and HTML are intercepted — JS/CSS use browser HTTP cache.
 */

const CACHE_NAME = 'fluentflow-v2';

// Activate immediately and claim all clients
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => k.startsWith('fluentflow-') && k !== CACHE_NAME)
            .map(k => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only intercept same-origin GET requests
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== 'GET') return;

  const isDataJson = url.pathname.includes('/data/') && url.pathname.endsWith('.json');
  const isHtml =
    url.pathname.endsWith('.html') ||
    url.pathname === '/' ||
    url.pathname.endsWith('/englishgame6/') ||
    url.pathname === '/englishgame6';
  const isAsset = /\.(js|css|woff2?|ttf|svg|png|ico|webp)$/.test(url.pathname);

  if (!isDataJson && !isHtml && !isAsset) return;

  // Hashed assets (contain hash in filename): cache-first (immutable)
  if (isAsset && /[-.][\da-f]{8,}\./.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      })
    );
    return;
  }

  // HTML, JSON data, unhashed assets: network-first with cache fallback
  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        const cached = await cache.match(event.request);
        if (cached) return cached;

        if (isDataJson) {
          return new Response(JSON.stringify({ error: 'MODULE_NOT_AVAILABLE_OFFLINE' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('App not available offline', { status: 503 });
      }
    })
  );
});
