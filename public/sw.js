/**
 * FluentFlow Service Worker
 * Estrategia: Network-first con fallback a Cache API para modo offline
 */

const CACHE_NAME = 'fluentflow-offline-v2';
const ASSETS_CACHE = 'fluentflow-assets-v2';

// Instalación: pre-cachear assets críticos
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(ASSETS_CACHE).then((cache) => {
      console.log('[SW] Pre-caching critical assets...');
      // Pre-cachear el HTML principal y learningModules.json
      // Los chunks de JS/CSS se cachearán dinámicamente cuando se carguen
      return cache.addAll([
        './',
        './index.html',
        './data/learningModules.json'
      ]).catch(err => {
        console.warn('[SW] Pre-cache failed (expected in dev):', err.message);
      });
    }).then(() => {
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

  // Ignorar peticiones de otros dominios y chrome-extension
  if (!url.origin.includes(self.location.origin) && !url.pathname.includes('englishgame6')) {
    return;
  }

  // Determinar qué cachear y con qué estrategia
  const isDataJson = url.pathname.includes('/data/') && url.pathname.endsWith('.json');
  const isModulesJson = url.pathname.includes('learningModules.json');
  const isJsAsset = url.pathname.includes('/assets/') && url.pathname.endsWith('.js');
  const isCssAsset = url.pathname.includes('/assets/') && url.pathname.endsWith('.css');
  const isHtml = url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/englishgame6/');

  const shouldIntercept = isDataJson || isModulesJson || isJsAsset || isCssAsset || isHtml;

  if (!shouldIntercept) {
    return;
  }

  // Estrategia 1: Assets de JS/CSS → Cache-first (son inmutables por hash)
  if (isJsAsset || isCssAsset) {
    event.respondWith(
      caches.open(ASSETS_CACHE).then(async (cache) => {
        // Try exact match first
        let cached = await cache.match(request);
        
        // If no match, try with absolute URL (for consistency with offlineManager)
        if (!cached && !request.url.startsWith('http')) {
          const absoluteUrl = new URL(request.url, self.location.origin).href;
          cached = await cache.match(absoluteUrl);
        }
        
        if (cached) {
          console.log('[SW] ✅ Asset from cache:', url.pathname);
          return cached;
        }

        console.log('[SW] Asset not cached, fetching:', url.pathname);
        try {
          const response = await fetch(request);
          if (response.ok) {
            cache.put(request, response.clone());
            console.log('[SW] ✅ Asset cached:', url.pathname);
          }
          return response;
        } catch (error) {
          console.error('[SW] ❌ Asset fetch failed:', url.pathname, error.message);
          // Si falla y no hay cache, devolver error genérico
          return new Response('Asset not available offline', { 
            status: 503,
            statusText: 'Service Unavailable'
          });
        }
      })
    );
    return;
  }

  // Estrategia 2: Data JSON → Network-first con fallback a cache
  if (isDataJson || isModulesJson) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          console.log('[SW] Fetching data:', url.pathname);
          const response = await fetch(request);
          
          if (response.ok) {
            cache.put(request, response.clone());
            console.log('[SW] ✅ Data cached:', url.pathname);
          }
          return response;
        } catch (error) {
          console.log('[SW] Network failed, checking cache:', url.pathname);
          
          // Try exact match first
          let cached = await cache.match(request);
          
          // If no match, try with absolute URL (for consistency with offlineManager)
          if (!cached && !request.url.startsWith('http')) {
            const absoluteUrl = new URL(request.url, self.location.origin).href;
            cached = await cache.match(absoluteUrl);
          }
          
          if (cached) {
            console.log('[SW] ✅ Data from cache:', url.pathname);
            return cached;
          }

          console.error('[SW] ❌ Data not available:', url.pathname);
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
        try {
          const response = await fetch(request);
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        } catch (error) {
          // Try exact match first
          let cached = await cache.match(request);
          
          // If no match, try with absolute URL
          if (!cached && !request.url.startsWith('http')) {
            const absoluteUrl = new URL(request.url, self.location.origin).href;
            cached = await cache.match(absoluteUrl);
          }
          
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
