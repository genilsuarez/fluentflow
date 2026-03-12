/**
 * FluentFlow Service Worker
 * Estrategia: Network-first con fallback a Cache API para modo offline
 */

const CACHE_NAME = 'fluentflow-offline-v5';
const ASSETS_CACHE = 'fluentflow-assets-v6';

/**
 * Normalize URL for consistent cache matching
 * Removes query params, hash, and trailing slashes
 */
function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    parsed.pathname = parsed.pathname.replace(/\/$/, '');
    return parsed.href;
  } catch (error) {
    console.warn('[SW] Failed to normalize URL:', url);
    return url;
  }
}

// Instalación: pre-cachear assets críticos
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    Promise.all([
      // Pre-cache learningModules.json en CACHE_NAME (crítico para offline)
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[SW] Pre-caching learningModules.json...');
        const modulesUrl = normalizeUrl('./data/learningModules.json');
        return cache.add(modulesUrl).catch(err => {
          console.warn('[SW] Failed to pre-cache modules (expected in dev):', err.message);
        });
      }),
      // Pre-cache HTML en ASSETS_CACHE
      caches.open(ASSETS_CACHE).then((cache) => {
        console.log('[SW] Pre-caching HTML...');
        return cache.addAll([
          './',
          './index.html'
        ]).catch(err => {
          console.warn('[SW] Pre-cache HTML failed (expected in dev):', err.message);
        });
      })
    ]).then(() => {
      console.log('[SW] Pre-cache complete');
      return self.skipWaiting();
    })
  );
});

// Activación: limpiar caches antiguas
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('fluentflow-') && name !== CACHE_NAME && name !== ASSETS_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Claiming clients...');
      return self.clients.claim();
    })
  );
});

// Fetch: Estrategia híbrida según tipo de recurso
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar peticiones de otros dominios (excepto las de nuestro path)
  if (url.origin !== self.location.origin) {
    return;
  }

  // Determinar qué cachear y con qué estrategia
  const isDataJson = url.pathname.includes('/data/') && url.pathname.endsWith('.json');
  const isModulesJson = url.pathname.includes('learningModules.json');
  const isHtml = url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/englishgame6/');

  // NOTE: JS/CSS assets are NOT intercepted by SW
  // Browser's native HTTP cache handles them better (respects hashes, ETags, etc)
  // This prevents issues with stale cached assets after new deployments

  const shouldIntercept = isDataJson || isModulesJson || isHtml;

  if (!shouldIntercept) {
    return;
  }

  // Estrategia 2: Data JSON → Network-first con fallback a cache
  if (isDataJson || isModulesJson) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const normalizedUrl = normalizeUrl(request.url);
        
        try {
          console.log('[SW] Fetching data:', url.pathname);
          const response = await fetch(request);
          
          if (response.ok) {
            // Store with normalized URL for consistent retrieval
            await cache.put(normalizedUrl, response.clone());
            console.log('[SW] ✅ Data cached:', url.pathname);
          }
          return response;
        } catch (error) {
          console.log('[SW] Network failed, checking cache:', url.pathname);
          
          // Try with normalized URL (primary method)
          let cached = await cache.match(normalizedUrl);
          
          if (cached) {
            console.log('[SW] ✅ Serving from cache (normalized):', url.pathname);
            return cached;
          }

          console.error('[SW] ❌ Not in cache:', url.pathname);
          console.error('[SW] Normalized URL:', normalizedUrl);
          return new Response(
            JSON.stringify({ error: 'MODULE_NOT_AVAILABLE_OFFLINE' }),
            {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }
      })
    );
    return;
  }

  // Estrategia 3: HTML → Network-first con fallback a cache
  if (isHtml) {
    event.respondWith(
      caches.open(ASSETS_CACHE).then(async (cache) => {
        const normalizedUrl = normalizeUrl(request.url);
        
        try {
          const response = await fetch(request);
          if (response.ok) {
            cache.put(normalizedUrl, response.clone());
          }
          return response;
        } catch (error) {
          // Try with normalized URL
          let cached = await cache.match(normalizedUrl);
          
          if (cached) {
            console.log('[SW] ✅ HTML from cache');
            return cached;
          }
          return new Response('App not available offline', { 
            status: 503,
            statusText: 'Service Unavailable'
          });
        }
      })
    );
  }
});
