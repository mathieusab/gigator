/* eslint-disable no-restricted-globals */

/// <reference lib="webworker" />

// Minimal service worker for installability and basic offline resilience.
// Built and injected by vite-plugin-pwa (injectManifest).

const CACHE_NAME = 'gigator-v1';

const sw = globalThis as unknown as ServiceWorkerGlobalScope;

// Workbox injectManifest placeholder: replaced at build time.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error - injected by workbox at build time
const WB_MANIFEST = self.__WB_MANIFEST as Array<{ url: string }>;

sw.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      // Precache build assets (best-effort).
      try {
        const cache = await caches.open(CACHE_NAME);
        const urls = Array.isArray(WB_MANIFEST) ? WB_MANIFEST.map((e) => e.url) : [];
        if (urls.length) await cache.addAll(urls);
      } catch {
        // Ignore precache failures (offline during install, etc.)
      }

      // Activate immediately.
      await sw.skipWaiting();
    })(),
  );
});

sw.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      await sw.clients.claim();
    })(),
  );
});

sw.addEventListener('fetch', (event: FetchEvent) => {
  const req = event.request;

  // Only cache GETs to same-origin.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== sw.location.origin) return;

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
