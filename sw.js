const CACHE_NAME = 'bookflow-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/app.html',
  '/booking.html',
  '/style.css',
  '/app.css',
  '/landing.css',
  '/booking.css',
  '/icon.svg',
  'https://unpkg.com/@phosphor-icons/web'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;
  
  // Ignore API calls and external domains
  if (!event.request.url.startsWith(self.location.origin)) {
      return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache the valid response
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If both fail and it's a page navigation, show offline fallback
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          // Otherwise do nothing (let it fail gracefully)
        });
      })
  );
});
