// HackPath Academy — Service Worker
// Caches the entire app for offline use

const CACHE_NAME = 'hackpath-v1';
const OFFLINE_URL = '/hackpath-academy/index.html';

// All assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/hackpath-academy/',
  '/hackpath-academy/index.html',
  // External fonts & libraries — cache on first fetch
];

// External origins to cache (CDN assets)
const CACHE_ORIGINS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net',
];

// ── INSTALL: pre-cache the app shell ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching app shell');
      return cache.addAll(PRECACHE_ASSETS).catch(err => {
        console.warn('[SW] Pre-cache failed (expected on first deploy):', err);
      });
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE: clean up old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: cache-first for app, network-first for APIs ──
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip EmailJS API calls — always need network
  if (url.hostname === 'api.emailjs.com') return;

  // Cache-first strategy for everything else
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        // Return cache immediately, update in background
        fetchAndCache(request);
        return cached;
      }

      // Not in cache — fetch from network and store
      return fetchAndCache(request);
    }).catch(() => {
      // Offline fallback — serve the app shell
      if (request.destination === 'document') {
        return caches.match(OFFLINE_URL);
      }
    })
  );
});

// Fetch from network and add to cache
function fetchAndCache(request) {
  return fetch(request).then(response => {
    // Only cache valid responses
    if (!response || response.status !== 200 || response.type === 'error') {
      return response;
    }

    // Don't cache opaque responses from non-CORS origins we don't control
    // Exception: allow CDN fonts and libraries
    const url = new URL(request.url);
    const shouldCache =
      url.origin === self.location.origin ||
      CACHE_ORIGINS.some(o => url.hostname.includes(o));

    if (shouldCache) {
      const responseClone = response.clone();
      caches.open(CACHE_NAME).then(cache => {
        cache.put(request, responseClone);
      });
    }

    return response;
  });
}
