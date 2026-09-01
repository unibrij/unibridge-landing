// service-worker.js

const CACHE_NAME =
  "unibridge-pay-shell-v1";

const CACHE_PREFIX =
  "unibridge-pay-shell-";


function isConnectRequest(
  request
) {
  try {
    const url =
      new URL(
        request.url
      );

    return (
      url.origin ===
        self.location.origin &&
      (
        url.pathname ===
          "/connect" ||
        url.pathname.startsWith(
          "/connect/"
        )
      )
    );
  }
  catch {
    return false;
  }
}


self.addEventListener(
  "install",
  event => {
    event.waitUntil(
      Promise.all([
        self.skipWaiting(),

        caches
          .open(
            CACHE_NAME
          )
          .then(
            cache =>
              Promise.allSettled([
                cache.add(
                  "/pay"
                ),

                cache.add(
                  "/surface/manifest.webmanifest"
                ),

                cache.add(
                  "/connect/icons/app/ub-app-icon-192.png"
                ),

                cache.add(
                  "/connect/icons/app/ub-app-icon-512.png"
                )
              ])
          )
      ])
    );
  }
);


self.addEventListener(
  "activate",
  event => {
    event.waitUntil(
      Promise.all([
        caches
          .keys()
          .then(
            keys =>
              Promise.all(
                keys
                  .filter(
                    key =>
                      key.startsWith(
                        CACHE_PREFIX
                      ) &&
                      key !==
                        CACHE_NAME
                  )
                  .map(
                    key =>
                      caches.delete(
                        key
                      )
                  )
              )
          ),

        self.clients.claim()
      ])
    );
  }
);


self.addEventListener(
  "fetch",
  event => {
    if (
      event.request.method !==
      "GET"
    ) {
      return;
    }

    /*
     * Connect owns its own deployment lifecycle.
     *
     * The root PWA worker must never intercept
     * Connect HTML, JavaScript, CSS or assets.
     */
    if (
      isConnectRequest(
        event.request
      )
    ) {
      return;
    }

    event.respondWith(
      fetch(
        event.request
      ).catch(
        async () => {
          const cache =
            await caches.open(
              CACHE_NAME
            );

          return cache.match(
            event.request
          );
        }
      )
    );
  }
);
