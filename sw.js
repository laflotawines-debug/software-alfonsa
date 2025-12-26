/**
 * Alfonsa Software - Service Worker
 * Versión estable PWA (root scope)
 */

const CACHE_NAME = 'alfonsa-cache-v1';

// App shell mínimo (solo navegación)
const APP_SHELL = [
  '/index.html'
];

// ============================
// 1. INSTALL
// ============================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );

  // Activación inmediata
  self.skipWaiting();
});

// ============================
// 2. ACTIVATE
// ============================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );

  // Tomamos control del sitio completo
  self.clients.claim();
});

// ============================
// 3. FETCH
// ============================
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Navegación (recarga / deep links)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
  }
  // Todo lo demás va directo a red (sin cachear)
});
