// HackPath Academy — Service Worker v2
// Single-file app: cache everything on first visit

const CACHE = 'hackpath-v2';

// On install — skip waiting, take over immediately
self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // Delete any old caches
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy: cache-first, fallback to network, store for later
self.addEventListener('fetch', e => {
  const req = e.request;

  // Only handle GET
  if (req.method !== 'GET') return;

  // Never intercept EmailJS API
  if (req.url.includes('api.emailjs.com')) return;

  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(req).then(cached => {
        // Fetch from network in parallel to update cache
        const networkFetch = fetch(req).then(res => {
          // Cache valid same-origin + CDN responses
          if (res && res.status === 200) {
            const url = new URL(req.url);
            const cacheable =
              url.hostname === self.location.hostname ||
              url.hostname.includes('fonts.googleapis.com') ||
              url.hostname.includes('fonts.gstatic.com') ||
              url.hostname.includes('cdn.jsdelivr.net');
            if (cacheable) cache.put(req, res.clone());
          }
          return res;
        }).catch(() => null);

        // Return cached immediately if available, otherwise wait for network
        return cached || networkFetch;
      })
    ).catch(() => caches.match(req)) // last resort: anything in cache
  );
});
