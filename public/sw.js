// REZZO service worker.
//
// This app has no build-time PWA plugin (no next-pwa — nothing in
// node_modules to generate one against in the sandbox this was built in),
// and Next.js hashes its JS/CSS chunk filenames per build, so there's no
// fixed asset list to precache safely. Strategy instead:
//
//   1. Same-origin static assets (JS/CSS/fonts/images/icons) — cached
//      opportunistically as the browser actually requests them
//      (stale-while-revalidate), so repeat loads are fast and the app
//      shell survives brief network drops. No fixed filenames needed.
//   2. /api/* — NEVER cached, always network. Case status, payments, quotes,
//      messages are live data; serving a stale response here would be
//      actively wrong, not just a degraded experience.
//   3. Page navigations — network-first, falling back to a cached copy of
//      the page, then to /offline.html as a last resort.
//
// Registered only in production (see layout.tsx) — a service worker
// intercepting fetches during `next dev` fights the dev server's HMR.

const CACHE_VERSION = 'rezzo-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('rezzo-') && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never touch the API — always network, never cached, never a fallback.
  if (url.pathname.startsWith('/api/')) return;

  // Page navigations: network-first so signed-in state and live content
  // are never served stale; fall back to a cached copy, then the offline
  // shell, only once the network is genuinely unreachable.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // Static assets (Next's hashed /_next/static chunks, fonts, icons,
  // manifest, images): stale-while-revalidate — serve from cache
  // immediately if present, and refresh the cache in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
