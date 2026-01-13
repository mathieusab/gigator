/* eslint-disable no-restricted-globals */

// Minimal service worker for installability and basic offline resilience.
// Built and injected by vite-plugin-pwa (injectManifest).

const CACHE_NAME = 'gigator-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      // Activate immediately.
      // @ts-expect-error - ServiceWorkerGlobalScope
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // @ts-expect-error - ServiceWorkerGlobalScope
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only cache GETs to same-origin.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // @ts-expect-error - ServiceWorkerGlobalScope
  if (url.origin !== self.location.origin) return;

  // Navigation: network-first with cache fallback.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, res.clone());
          return res;
        } catch {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(req);
          if (cached) return cached;
          return new Response('Offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        }
      })(),
    );
    return;
  }

  // Assets: stale-while-revalidate.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);

      return cached ?? (await fetchPromise) ?? new Response('Offline', { status: 503 });
    })(),
  );
});
