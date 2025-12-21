
const CACHE_NAME = 'alfonsa-v2'; // Incrementamos la versión para forzar limpieza
const ASSETS_TO_CACHE = [
  './index.html',
  './manifest.json'
];

// Instalación: Guardamos solo lo crítico
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Limpieza: Borramos cachés viejas que causaron el error del texto/código
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia: Network First (Primero busca en internet, si falla usa caché)
// Esto evita que el código JS se sirva como si fuera el HTML de la página
self.addEventListener('fetch', (event) => {
  // Solo interceptamos peticiones de navegación (páginas) o archivos locales
  if (event.request.mode === 'navigate' || event.request.url.includes(self.location.origin)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Si la respuesta es válida, la guardamos/actualizamos en caché
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          // Si no hay internet, intentamos servir desde caché
          return caches.match(event.request);
        })
    );
  }
});
