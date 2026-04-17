// Service Worker — Cellion One
// CACHE_VERSION is replaced at production build time by the vite injectSwVersion plugin.
// In dev mode it stays as the literal placeholder string, which is acceptable.
//
// Strategy:
//  - Navigation requests: network-first, offline.html fallback
//  - API requests:        network-only, JSON offline fallback
//  - Static assets:       cache-first (runtime caching).
//                         Vite content-hashes ensure cached entries are never stale.
//                         New deployments produce new hashed filenames → network fetched → cached.
//                         Old entries in the old CACHE_NAME are purged on activate.

const CACHE_VERSION = '__BUILD_VERSION__';
const CACHE_NAME = 'cellion-one-' + CACHE_VERSION;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.add(OFFLINE_URL);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Navigation requests: try network, fall back to offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_URL);
      })
    );
    return;
  }

  // API requests: network only, return offline JSON on failure
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'Offline', offline: true }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // Static assets (JS, CSS, images, fonts): cache-first with network fallback.
  // Vite content-hashed filenames guarantee no stale assets are ever served —
  // a new deployment uses new hashed URLs not present in the old cache.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const toCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, toCache));
        }
        return response;
      });
    })
  );
});
