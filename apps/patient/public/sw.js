// NutriCore Patient PWA — Service Worker minimal (Lock 16)
//
// Estratégia: network-first com fallback de cache + offline shell.
// Não cacheia API (apenas estático + HTML shell).

const CACHE_VERSION = "nutricore-patient-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const PRECACHE_URLS = ["/offline.html", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== STATIC_CACHE && name !== RUNTIME_CACHE)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip cross-origin (Supabase, etc.)
  if (url.origin !== self.location.origin) return;

  // Skip API routes (always network)
  if (url.pathname.startsWith("/api/")) return;

  // Skip POST/PUT/DELETE (não cacheia mutations)
  if (event.request.method !== "GET") return;

  // HTML pages: network-first, fallback to cache, then offline shell
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful navigations
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(event.request)
            .then((cached) => cached || caches.match("/offline.html")),
        ),
    );
    return;
  }

  // Static assets: cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:js|css|woff2?|png|svg|webp|ico)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches
                .open(STATIC_CACHE)
                .then((c) => c.put(event.request, clone));
            }
            return response;
          }),
      ),
    );
  }
});
