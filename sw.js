const CACHE_NAME = 'claret-real-v33';

const ASSETS_TO_CACHE = [
  './',
  './manifest.json'
];

// ── INSTALAR ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVAR: limpiar cachés viejas ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── ESCUCHAR MENSAJES (para SKIP_WAITING desde el cliente) ──
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── FETCH ──
self.addEventListener('fetch', (event) => {

  // No cachear llamadas a GAS
  if (event.request.url.includes('/exec') || event.request.url.includes('script.google.com')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response(JSON.stringify({status: "error", message: "Sin conexión"}), {
        headers: {'Content-Type': 'application/json'}
      }))
    );
    return;
  }

  const url = new URL(event.request.url);

  // ── INDEX.HTML: red primero (siempre trae la última versión) ──
  if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname.endsWith('/index.html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // ── DEMÁS ARCHIVOS (iconos, manifest): cache primero ──
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
