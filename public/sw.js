/*
 * Andes service worker.
 *
 * Estrategia conservadora para el flujo con mala señal:
 *  - App shell y assets estáticos same-origin: cache-first (los chunks de Next
 *    en /_next/static son inmutables, ideales para cachear).
 *  - Navegaciones y payloads RSC: network-first con fallback a la última copia
 *    cacheada (o al shell "/"), para que la app abra aunque no haya red.
 *  - NUNCA cachea POST, rutas /api ni cross-origin (R2, uploads, sync).
 *
 * La resiliencia de datos (borrador + cola de fotos en IndexedDB) vive en el
 * cliente; ver src/lib/client/upload-queue.ts.
 */

const CACHE = "andes-shell-v2";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isRscRequest(request, url) {
  return request.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Solo GET same-origin. El resto (POST, /api, R2, cross-origin) va directo a red.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Navegaciones y RSC: network-first, fallback a cache (o al shell).
  if (request.mode === "navigate" || isRscRequest(request, url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((r) => r ?? caches.match("/")),
        ),
    );
    return;
  }

  // Assets estáticos: cache-first, poblar en miss.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
