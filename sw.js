
/**
 * Alfonsa Software - Service Worker v3.0
 * Corregido para evitar "Cache Poisoning" y errores de origen.
 */

const CACHE_NAME = 'alfonsa-v3-final';
const STATIC_ASSETS = [
  './index.html',
  './manifest.json'
];

// 1. Instalación: Precarga el 'corazón' de la app
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// 2. Activación: Limpia CUALQUIER caché previa para eliminar el error del texto/código
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  return self.clients.claim();
});

// 3. Estrategia de Red: SEGURIDAD ANTE TODO
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // A. PETICIONES DE NAVEGACIÓN (Cuando entras a la app)
  // Solo devolvemos HTML. Esto evita que el JS se cargue como página principal.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('./index.html');
      })
    );
    return;
  }

  // B. ARCHIVOS ESTÁTICOS (JS, CSS, Imágenes, Manifiesto)
  // Usamos "Network-First" pero NO guardamos el JS en caché dinámicamente 
  // para evitar el error de origen cruzado en el entorno de previsualización.
  if (STATIC_ASSETS.some(asset => request.url.includes(asset.replace('./', '')))) {
    event.respondWith(
      caches.match(request).then((response) => {
        return response || fetch(request);
      })
    );
  }
});
