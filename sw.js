const CACHE_NAME = 'bookflow-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.html',
  '/booking.html',
  '/style.css',
  '/app.css',
  '/landing.css',
  '/booking.css',
  '/icon.svg',
  '/app.js',
  '/dashboard.js',
  '/calendar.js',
  '/auth.js',
  '/config.js',
  '/firebase-config.js',
  '/flowai.js',
  '/i18n.js'
];

const API_ORIGIN = 'https://generativelanguage.googleapis.com';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (url.origin === API_ORIGIN || event.request.method !== 'GET') return;
  
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request).then((r) => r || caches.match('/')))
    );
  }
});
