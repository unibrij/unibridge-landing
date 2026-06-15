const CACHE_NAME = "unibridge-pay-shell-v1";
const CACHE_PREFIX = "unibridge-pay-shell-";

self.addEventListener("install", event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled([
        cache.add("/pay"),
        cache.add("/surface/manifest.webmanifest"),
        cache.add("/connect/icons/app/ub-app-icon-192.png"),
        cache.add("/connect/icons/app/ub-app-icon-512.png")
      ])
    )
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key =>
            key.startsWith(CACHE_PREFIX) &&
            key !== CACHE_NAME
          )
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request)
    )
  );
});
