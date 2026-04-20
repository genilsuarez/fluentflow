/**
 * FluentFlow Service Worker
 * Strategy: Network-first with Cache API fallback for offline mode.
 * Hashed assets use cache-first with network fallback.
 *
 * Asset precaching is triggered from the client side (main.tsx) via postMessage,
 * not from the SW fetch handler. This is more reliable across browsers,
 * especially WebKit-based browsers on iOS.
 */

const CACHE_NAME = 'fluentflow-v3';

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

// Client-triggered precaching via postMessage
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'PRECACHE_ASSETS') {
    event.waitUntil(precacheAssets(event.data.assets, event.data.baseUrl));
  }
});

/**
 * Pre-cache a list of asset URLs and clean up stale ones.
 */
async function precacheAssets(assets, baseUrl) {
  if (!assets || assets.length === 0) return;

  const cache = await caches.open(CACHE_NAME);
  const currentUrls = new Set(assets);

  // Fetch missing assets in parallel (batches of 6)
  const missing = [];
  for (const url of assets) {
    if (!(await cache.match(url))) missing.push(url);
  }

  if (missing.length > 0) {
    const batchSize = 6;
    for (let i = 0; i < missing.length; i += batchSize) {
      await Promise.allSettled(
        missing.slice(i, i + batchSize).map(async url => {
          try {
            const res = await fetch(url);
            if (res.ok) await cache.put(url, res);
          } catch {
            // Individual failures are non-critical
          }
        })
      );
    }
  }

  // Clean up stale hashed assets from previous builds.
  // Keep assets from the immediately previous build to avoid breaking
  // clients that still reference old chunks (e.g. iOS Safari with stale HTML).
  // Only remove assets that are TWO or more builds old.
  try {
    const PREV_ASSETS_KEY = 'fluentflow-prev-assets';
    const keys = await cache.keys();
    const prevAssetsJson = await caches.open(CACHE_NAME).then(c => c.match(PREV_ASSETS_KEY));
    const prevAssets = prevAssetsJson ? new Set(await prevAssetsJson.json()) : new Set();

    // Assets to remove: not in current build AND not in previous build
    for (const req of keys) {
      const pathname = new URL(req.url).pathname;
      if (
        pathname.includes('/assets/') &&
        /[-.][\da-f]{8,}\./.test(pathname) &&
        !currentUrls.has(req.url) &&
        !prevAssets.has(req.url)
      ) {
        await cache.delete(req);
      }
    }

    // Save current assets as "previous" for next deploy cycle
    const allHashedNow = keys
      .map(r => r.url)
      .filter(u => {
        const p = new URL(u).pathname;
        return p.includes('/assets/') && /[-.][\da-f]{8,}\./.test(p) && currentUrls.has(u);
      });
    await cache.put(
      PREV_ASSETS_KEY,
      new Response(JSON.stringify(allHashedNow), { headers: { 'Content-Type': 'application/json' } })
    );
  } catch {
    // Non-critical
  }
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only intercept same-origin GET requests
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== 'GET') return;

  const isDataJson = url.pathname.includes('/data/') && url.pathname.endsWith('.json');
  const isHtml =
    url.pathname.endsWith('.html') ||
    url.pathname === '/' ||
    url.pathname.endsWith('/fluentflow/') ||
    url.pathname === '/fluentflow';
  const isAsset = /\.(js|css|woff2?|ttf|svg|png|ico|webp)$/.test(url.pathname);
  const isManifest = url.pathname.endsWith('asset-manifest.json');

  if (!isDataJson && !isHtml && !isAsset && !isManifest) return;

  // Hashed assets (contain hash in filename): cache-first (immutable)
  if (isAsset && /[-.][\da-f]{8,}\./.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        } catch {
          return new Response('', { status: 503, statusText: 'Asset unavailable offline' });
        }
      })
    );
    return;
  }

  // HTML and asset-manifest: network-first with cache fallback
  if (isHtml || isManifest) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        try {
          const response = await fetch(event.request);
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        } catch {
          const cached = await cache.match(event.request);
          if (cached) return cached;
          if (isHtml) return new Response('App not available offline', { status: 503 });
          return new Response('[]', { status: 503, headers: { 'Content-Type': 'application/json' } });
        }
      })
    );
    return;
  }

  // JSON data, unhashed assets: network-first with cache fallback
  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      try {
        const response = await fetch(event.request);
        if (response.ok) cache.put(event.request, response.clone());
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
        return new Response('Resource not available offline', { status: 503 });
      }
    })
  );
});
