// ============================================
// SERVICE WORKER - Claret Real VI
// ============================================

const CACHE_NAME = "claret-real-v8";

const CACHE_ASSETS = [
    "./"
];

// ============================
// INSTALAR
// ============================

self.addEventListener("install", event => {

    event.waitUntil(

        caches.open(CACHE_NAME)

        .then(cache => cache.addAll(CACHE_ASSETS))

        .then(() => self.skipWaiting())

        .catch(() => Promise.resolve())

    );

});

// ============================
// ACTIVAR
// ============================

self.addEventListener("activate", event => {

    event.waitUntil(

        caches.keys()

        .then(keys => {

            return Promise.all(

                keys

                .filter(key => key !== CACHE_NAME)

                .map(key => caches.delete(key))

            );

        })

        .then(() => self.clients.claim())

    );

});

// ============================
// FETCH
// ============================

self.addEventListener("fetch", event => {

    if (event.request.method !== "GET")
        return;

    const url = new URL(event.request.url);

    // No cachear llamadas POST o Apps Script
    if (url.pathname.includes("/macros/s/"))
        return;

    event.respondWith(

        caches.match(event.request)

        .then(cache => {

            if (cache)
                return cache;

            return fetch(event.request)

            .then(response => {

                if (!response || !response.ok)
                    return response;

                // Cachear tanto basic como cors
                if (
                    response.type === "basic" ||
                    response.type === "cors"
                ) {

                    const copia = response.clone();

                    caches.open(CACHE_NAME)

                    .then(cache => cache.put(event.request, copia));

                }

                return response;

            });

        })

        .catch(() => {

            if (event.request.mode === "navigate")
                return caches.match("./");

        })

    );

});
