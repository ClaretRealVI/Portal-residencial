// ============================================
// SERVICE WORKER - Claret Real VI
// ============================================

const CACHE_NAME = 'claret-real-v1';
const CACHE_ASSETS = [
  './',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://i.postimg.cc/s2YfdY8Q/image-Picsart-Background-Remover.png',
  'https://i.imgur.com/G2pDQyY.jpeg'
];

// Instalación: precachear assets estáticos
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(CACHE_ASSETS).catch(function() {
        // Si falla algún asset (ej. red), no bloquea la instalación
        return Promise.resolve();
      });
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Activación: limpiar caches viejas
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          return key !== CACHE_NAME;
        }).map(function(key) {
          return caches.delete(key);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch: Network First para API, Cache First para estáticos
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // No cachear peticiones POST ni a la API
  if (event.request.method === 'POST') return;
  if (url.pathname.indexOf('/macros/s/') !== -1) return;

  // Para recursos estáticos: Cache First
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;

      return fetch(event.request).then(function(response) {
        // Solo cachear respuestas exitosas del mismo origen
        if (response.ok && response.type === 'basic') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        // Fallback offline para la página principal
        if (event.request.mode === 'navigate') {
          return caches.match('./');
        }
      });
    })
  );
});