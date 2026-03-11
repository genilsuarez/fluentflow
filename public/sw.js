/**
 * FluentFlow Service Worker
 * Estrategia: Network-first con fallback a Cache API para modo offline
 */

const CACHE_NAME = 'fluentflow-offline-v1';

// Instalación: no pre-cachear nada (se hace desde la UI)
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  self.skipWaiting();
});

// Activación: limpiar caches antiguas
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('fluentflow-') && name !== CACHE_NAME)
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

// Fetch: Network-first, fallback a cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptar peticiones JSON de data/
  if (!url.pathname.includes('/data/') && !url.pathname.includes('learningModules.json')) {
    return;
  }

  console.log('[SW] Intercepting:', url.pathname);

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return fetch(request)
        .then((response) => {
          // Si hay red, devolver respuesta
          console.log('[SW] Network success:', url.pathname);
          return response;
        })
        .catch(async () => {
          // Sin red: buscar en cache con múltiples estrategias
          console.log('[SW] Network failed, trying cache:', url.pathname);
          
          // Estrategia 1: Match exacto
          let cachedResponse = await cache.match(request);
          
          // Estrategia 2: Match sin query params
          if (!cachedResponse) {
            const urlWithoutQuery = new URL(request.url);
            urlWithoutQuery.search = '';
            cachedResponse = await cache.match(urlWithoutQuery.toString());
          }
          
          // Estrategia 3: Match solo pathname (sin origin)
          if (!cachedResponse) {
            const keys = await cache.keys();
            for (const key of keys) {
              const keyUrl = new URL(key.url);
              if (keyUrl.pathname === url.pathname) {
                cachedResponse = await cache.match(key);
                console.log('[SW] Found via pathname match:', keyUrl.href);
                break;
              }
            }
          }
          
          if (cachedResponse) {
            console.log('[SW] Serving from cache:', url.pathname);
            return cachedResponse;
          }
          
          // No hay cache: devolver error offline
          console.warn('[SW] Not in cache:', url.pathname);
          return new Response(
            JSON.stringify({ error: 'MODULE_NOT_AVAILABLE_OFFLINE' }),
            {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'application/json' }
            }
          );
        });
    })
  );
});
