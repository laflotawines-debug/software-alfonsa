const CACHE_NAME = 'alfonsa-v3';
const APP_SHELL = ['/index.html', '/manifest.json', '/index.css'];

// INSTALL
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ACTIVATE
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => k !== CACHE_NAME && caches.delete(k)))
    )
  );
  self.clients.claim();
});

// FETCH
self.addEventListener('fetch', event => {
  const { request } = event;

  // 1️⃣ Navegaciones → index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch('/index.html').catch(() => caches.match('/index.html'))
    );
    return;
  }

  // 2️⃣ No tocar requests externos (esm.sh, fonts, etc)
  if (!request.url.startsWith(self.location.origin)) {
    return;
  }

  // 3️⃣ Assets locales → cache first
  event.respondWith(
    caches.match(request).then(cached =>
      cached ||
      fetch(request).then(response => {
        if (response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
    )
  );
});
