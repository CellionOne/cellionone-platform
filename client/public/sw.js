// Service Worker — Cellion One
// Strategy: network-first for everything.
// Static JS/CSS assets are cache-busted by Vite's content-hash filenames,
// so we rely on HTTP caching headers rather than a SW cache.
// The only thing we cache here is the offline fallback page.
//
// CACHE_VERSION is replaced at production build time by the vite injectSwVersion plugin.
// In dev mode it stays as the literal placeholder string, which is fine.

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

  // All other requests (JS, CSS, images, fonts): network only.
  // Vite content-hashed filenames + HTTP Cache-Control headers handle caching.
  // Do NOT intercept — let the browser handle it directly.
});
