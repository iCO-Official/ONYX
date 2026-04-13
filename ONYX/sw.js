const CACHE_NAME = "onyx-pwa-v3";
const ASSETS = [
  "/",
  "/index.html",
  "/login.html",
  "/register.html",
  "/home.html",
  "/profile.html",
  "/settings.html",
  "/queue.html",
  "/manifest.json",
  "/assets/styles.css",
  "/assets/app.js",
  "/assets/providers.js",
  "/assets/logo.svg",
  "/web-bridge.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isDynamicAsset = sameOrigin && [".js", ".css", ".html"].some((ext) => url.pathname.endsWith(ext));

  if (isDynamicAsset) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/index.html")))
    );
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
