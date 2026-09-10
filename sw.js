const CACHE_NAME = 'edificioclaret-real-V6';

const ASSETS_TO_CACHE = [
  './',
  './manifest.json'
];

// ==========================================
// INSTALACIÓN
// ==========================================
self.addEventListener('install', (event) => {

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );

});


// ==========================================
// ACTIVACIÓN
// Limpiar versiones anteriores del caché
// ==========================================
self.addEventListener('activate', (event) => {

  event.waitUntil(

    caches.keys()
      .then((keys) => {

        return Promise.all(

          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))

        );

      })
      .then(() => self.clients.claim())

  );

});


// ==========================================
// FETCH
// ==========================================
self.addEventListener('fetch', (event) => {

  // Solo manejar solicitudes GET
  if (event.request.method !== 'GET') {
    return;
  }


  // ==========================================
  // NO INTERCEPTAR GOOGLE APPS SCRIPT
  // ==========================================
  const requestUrl = event.request.url;

  if (
    requestUrl.includes('script.google.com') ||
    requestUrl.includes('/exec')
  ) {
    return;
  }


  const url = new URL(requestUrl);


  // ==========================================
  // INDEX / PÁGINA PRINCIPAL
  // NETWORK FIRST
  // ==========================================
  if (
    url.pathname === '/' ||
    url.pathname.endsWith('/index.html')
  ) {

    event.respondWith(

      fetch(event.request)

        .then((response) => {

          if (response && response.status === 200) {

            const clone = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, clone);
              });

          }

          return response;

        })

        // Si no hay internet → usar caché
        .catch(() => {

          return caches.match(event.request);

        })

    );

    return;
  }


  // ==========================================
  // DEMÁS ARCHIVOS
  // CACHE FIRST
  // ==========================================
  event.respondWith(

    caches.match(event.request)

      .then((cachedResponse) => {

        // Si existe en caché
        if (cachedResponse) {
          return cachedResponse;
        }


        // Si no existe → descargar
        return fetch(event.request)

          .then((response) => {

            // No guardar respuestas inválidas
            if (
              !response ||
              response.status !== 200 ||
              response.type !== 'basic'
            ) {
              return response;
            }


            const clone = response.clone();

            caches.open(CACHE_NAME)

              .then((cache) => {
                cache.put(event.request, clone);
              });


            return response;

          });

      })

      // Si falla completamente
      .catch(() => {

        return new Response(
          'Sin conexión a internet',
          {
            status: 503,
            statusText: 'Servicio no disponible'
          }
        );

      })

  );

});
