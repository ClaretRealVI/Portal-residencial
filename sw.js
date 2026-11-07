/* =====================================================================
   SERVICE WORKER - Claret Real VI
   Versión: 2.0 (Sistema de actualizaciones obligatorias)
   =====================================================================
   Cambios respecto a la versión anterior:
   - skipWaiting() en install (activación inmediata)
   - clients.claim() en activate (toma control de todas las pestañas)
   - Notifica a TODOS los clientes cuando hay una nueva versión
   - Network-first con timeout corto para index.html (3s)
   - Limpieza automática de cachés antiguos
   - Responde a mensajes para limpiar caché bajo demanda
   ===================================================================== */

// >>> CAMBIAR ESTE NÚMERO CADA VEZ QUE SUBAS UNA ACTUALIZACIÓN <<<
const CACHE_NAME = 'edificioclaret-real-V15';
const APP_VERSION = '2026-11-07-v1';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
];

// =====================================================================
// INSTALACIÓN
// skipWaiting() fuerza la activación inmediata del nuevo SW
// sin esperar a que se cierren todas las pestañas
// =====================================================================
self.addEventListener('install', (event) => {
  // Forzar activación inmediata (clave para que TODOS vean los cambios)
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .catch((err) => console.log('[SW] Error cacheando assets:', err))
  );
});

// =====================================================================
// ACTIVACIÓN
// 1. Limpiar TODOS los cachés anteriores (no solo los que coinciden)
// 2. clients.claim() toma control de TODAS las pestañas abiertas
// 3. Notificar a todos los clientes que hay nueva versión
// =====================================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Limpiar cachés antiguos
      caches.keys()
        .then((keys) => {
          return Promise.all(
            keys
              .filter((key) => key !== CACHE_NAME)
              .map((key) => {
                console.log('[SW] Eliminando caché antiguo:', key);
                return caches.delete(key);
              })
          );
        }),
      // Tomar control inmediatamente de TODAS las pestañas
      self.clients.claim(),
      // Notificar a todos los clientes sobre la nueva versión
      notifyAllClientsOfUpdate()
    ])
  );
});

// =====================================================================
// FUNCIÓN: Notificar a todos los clientes sobre la actualización
// =====================================================================
async function notifyAllClientsOfUpdate() {
  try {
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true  // Importante: incluye pestañas que el SW aún no controla
    });

    clients.forEach((client) => {
      client.postMessage({
        type: 'SW_UPDATED',
        version: APP_VERSION,
        cacheName: CACHE_NAME,
        timestamp: Date.now()
      });
    });

    console.log('[SW] Notificados', clients.length, 'clientes sobre nueva versión', APP_VERSION);
  } catch (err) {
    console.log('[SW] Error notificando clientes:', err);
  }
}

// =====================================================================
// FETCH
// =====================================================================
self.addEventListener('fetch', (event) => {
  // Solo manejar GET
  if (event.request.method !== 'GET') return;

  const requestUrl = event.request.url;

  // NO interceptar Google Apps Script (API del backend)
  if (
    requestUrl.includes('script.google.com') ||
    requestUrl.includes('/exec')
  ) {
    return;
  }

  // NO interceptar imágenes externas (imgur, etc.)
  if (
    requestUrl.includes('imgur.com') ||
    requestUrl.includes('postimg.cc') ||
    requestUrl.includes('googleapis.com') ||
    requestUrl.includes('gstatic.com') ||
    requestUrl.includes('cloudflare.com')
  ) {
    return;
  }

  const url = new URL(requestUrl);

  // =====================================================================
  // INDEX / PÁGINA PRINCIPAL
  // NETWORK FIRST con timeout corto (3 segundos)
  // Si la red tarda más, usa caché pero en background actualiza
  // =====================================================================
  if (
    url.pathname === '/' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname === '' ||
    url.pathname.endsWith('/')
  ) {
    event.respondWith(networkFirstWithTimeout(event.request, 3000));
    return;
  }

  // =====================================================================
  // DEMÁS ARCHIVOS LOCALES
  // CACHE FIRST (más rápido para assets estáticos)
  // =====================================================================
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Actualizar en background (stale-while-revalidate)
          fetch(event.request).then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, clone);
              });
            }
          }).catch(() => {});
          return cachedResponse;
        }

        return fetch(event.request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
            return response;
          });
      })
      .catch(() => {
        return new Response('Sin conexión a internet', {
          status: 503,
          statusText: 'Servicio no disponible',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
  );
});

// =====================================================================
// FUNCIÓN: Network First con Timeout
// Intenta la red primero, si tarda demasiado usa caché
// =====================================================================
function networkFirstWithTimeout(request, timeoutMs) {
  return new Promise((resolve) => {
    let resolved = false;
    let timeoutId;

    // Timeout: si la red tarda mucho, usar caché
    timeoutId = setTimeout(() => {
      if (!resolved) {
        caches.match(request).then((cached) => {
          if (cached && !resolved) {
            resolved = true;
            resolve(cached);
          }
        });
      }
    }, timeoutMs);

    // Intentar red
    fetch(request)
      .then((response) => {
        if (resolved) return; // Ya respondimos con caché
        clearTimeout(timeoutId);
        resolved = true;

        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
        }
        resolve(response);
      })
      .catch(() => {
        if (resolved) return;
        clearTimeout(timeoutId);
        // Caer al caché
        caches.match(request).then((cached) => {
          resolved = true;
          if (cached) {
            resolve(cached);
          } else {
            resolve(new Response('Sin conexión a internet', {
              status: 503,
              statusText: 'Servicio no disponible',
              headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            }));
          }
        });
      });
  });
}

// =====================================================================
// MESSAGE
// Permite al frontend comunicarse con el SW
// =====================================================================
self.addEventListener('message', (event) => {
  const data = event.data || {};

  // Forzar activación inmediata
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Limpiar todo el caché bajo demanda
  if (data.type === 'CLEAR_CACHE') {
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => {
        if (event.source) {
          event.source.postMessage({ type: 'CACHE_CLEARED', version: APP_VERSION });
        }
      });
  }

  // Verificar versión actual
  if (data.type === 'GET_VERSION') {
    if (event.source) {
      event.source.postMessage({ type: 'VERSION_INFO', version: APP_VERSION, cacheName: CACHE_NAME });
    }
  }

  // Forzar recarga de todos los clientes
  if (data.type === 'RELOAD_ALL_CLIENTS') {
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'FORCE_RELOAD' });
        });
      });
  }
});

// =====================================================================
// PERIODIC SYNC (si está disponible)
// Verifica actualizaciones periódicamente
// =====================================================================
if ('periodicSync' in self) {
  self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'check-updates') {
      event.waitUntil(notifyAllClientsOfUpdate());
    }
  });
}
