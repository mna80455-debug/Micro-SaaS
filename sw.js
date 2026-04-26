// BookFlow Service Worker — v5
const CACHE_VERSION = 'bookflow-v5';
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
  '/manifest.json',
  '/dashboard.js',
  '/calendar.js',
  '/auth.js',
  '/config.js',
  '/firebase-config.js',
  '/flowai.js',
  '/i18n.js',
  '/booking.js',
  '/notifications.js',
  '/gcal.js',
  '/theme-manager.js',
  '/components/toast.js'
];

// These origins are NEVER cached (external APIs)
const BYPASS_ORIGINS = [
  'https://generativelanguage.googleapis.com',
  'https://identitytoolkit.googleapis.com',
  'https://firestore.googleapis.com',
  'https://securetoken.googleapis.com',
  'https://accounts.google.com',
  'https://api.emailjs.com',
  'https://wa.me'
];

// ── Install ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((c) => c.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_VERSION)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch — Network-First for app, Cache-First for assets ─
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and external API calls
  if (event.request.method !== 'GET') return;
  if (BYPASS_ORIGINS.some((o) => event.request.url.startsWith(o))) return;

  // For same-origin requests: Network-first with cache fallback
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(event.request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => {
            if (cached) return cached;
            // Offline fallback: return the app shell
            if (event.request.mode === 'navigate') {
              return caches.match('/app.html');
            }
            return new Response('', { status: 408 });
          })
        )
    );
  }
});

// ── Push Notifications (future) ───────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || 'BookFlow', {
    body: data.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    dir: 'rtl',
    lang: 'ar',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/app.html' }
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/app.html';
  event.waitUntil(clients.openWindow(url));
});
