/**
 * FluentFlow Service Worker
 * Strategy: Network-first with Cache API fallback for offline mode.
 * Hashed assets use cache-first with network fallback.
 *
 * On HTML navigation: after caching the fresh HTML, parses it to discover
 * referenced hashed assets and pre-caches any that are missing. This ensures
 * lazy-loaded chunks are available offline even after a new deploy.
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

/**
 * Parse HTML to extract hashed asset URLs (JS/CSS from /assets/).
 * Then fetch the asset-manifest.json for the full list of chunks
 * (including lazy-loaded ones not referenced in the initial HTML).
 */
async function precacheAssetsFromHtml(htmlResponse, baseUrl) {
  try {
    const html = await htmlResponse.text();
    const cache = await caches.open(CACHE_NAME);

    // Collect asset URLs from both HTML and manifest
    const assetUrls = new Set();

    // 1. Extract assets referenced in HTML (entry points)
    const srcPattern = /(?:src|href)=["']([^"']*\/assets\/[^"']+)["']/g;
    let match;
    while ((match = srcPattern.exec(html)) !== null) {
      const path = match[1];
      const url = path.startsWith('http')
        ? path
        : new URL(path, baseUrl).href;
      assetUrls.add(url);
    }

    // 2. Fetch asset-manifest.json for ALL chunks (including lazy-loaded)
    try {
      const manifestUrl = new URL('asset-manifest.json', baseUrl).href;
      const manifestRes = await fetch(manifestUrl);
      if (manifestRes.ok) {
        const assets = await manifestRes.json();
        for (const asset of assets) {
          assetUrls.add(new URL(asset, baseUrl).href);
        }
        // Cache the manifest itself
        cache.put(manifestUrl, manifestRes.clone());
      }
    } catch {
      // Manifest unavailable — HTML-only assets will still be cached
    }

    if (assetUrls.size === 0) return;

    // Check which assets are missing from cache and fetch them
    const missing = [];
    for (const url of assetUrls) {
      const cached = await cache.match(url);
      if (!cached) missing.push(url);
    }

    if (missing.length === 0) return;

    // Fetch missing assets in parallel (max 6 concurrent)
    const batchSize = 6;
    for (let i = 0; i < missing.length; i += batchSize) {
      const batch = missing.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async url => {
          const res = await fetch(url);
          if (res.ok) await cache.put(url, res);
        })
      );
      // Silently ignore individual failures — SW will try again on next navigation
    }

    // Clean up stale assets: remove cached hashed assets not in current manifest
    await cleanupStaleAssets(cache, assetUrls);
  } catch {
    // Non-critical: precaching is best-effort
  }
}

/**
 * Remove hashed assets from cache that are no longer referenced
 * by the current build (stale chunks from previous deploys).
 */
async function cleanupStaleAssets(cache, currentAssetUrls) {
  try {
    const keys = await cache.keys();
    const staleRequests = keys.filter(req => {
      const url = new URL(req.url);
      // Only clean up hashed assets in /assets/ directory
      if (!url.pathname.includes('/assets/')) return false;
      if (!/[-.][\da-f]{8,}\./.test(url.pathname)) return false;
      return !currentAssetUrls.has(req.url);
    });

    for (const req of staleRequests) {
      await cache.delete(req);
    }
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
        try {
          const response = await fetch(event.request);
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        } catch {
          // Network failed and not in cache — return 503 so the app can handle it
          return new Response('', { status: 503, statusText: 'Asset unavailable offline' });
        }
      })
    );
    return;
  }

  // HTML: network-first, and on success trigger background precaching of assets
  if (isHtml) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        try {
          const response = await fetch(event.request);
          if (response.ok) {
            cache.put(event.request, response.clone());
            // Derive base URL from the HTML page URL for resolving relative paths
            const htmlUrl = response.url || event.request.url;
            const baseUrl = htmlUrl.endsWith('/')
              ? htmlUrl
              : htmlUrl.substring(0, htmlUrl.lastIndexOf('/') + 1);
            // Pre-cache assets in background (non-blocking)
            event.waitUntil(precacheAssetsFromHtml(response.clone(), baseUrl));
          }
          return response;
        } catch {
          const cached = await cache.match(event.request);
          if (cached) return cached;
          return new Response('App not available offline', { status: 503 });
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
