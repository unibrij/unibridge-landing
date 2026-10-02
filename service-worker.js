// unibridge-landing/service-worker.js

const CACHE_NAME =
  "unibridge-shell-v2";

const CACHE_PREFIX =
  "unibridge-shell-";

const LEGACY_CACHE_PREFIXES = [
  "unibridge-pay-shell-"
];

const SHELL_ASSETS = [
  "/pay/",
  "/surface/",
  "/receive/",
  "/manifest.webmanifest",
  "/connect/icons/app/ub-app-icon-192.png",
  "/connect/icons/app/ub-app-icon-512.png"
];


/*
--------------------------------------------------
Request helpers
--------------------------------------------------
*/

function getRequestUrl(request) {
  try {
    return new URL(
      request.url
    );
  }
  catch {
    return null;
  }
}


function isSameOriginRequest(
  request
) {
  const url =
    getRequestUrl(
      request
    );

  return Boolean(
    url &&
    url.origin ===
      self.location.origin
  );
}


function isConnectRequest(
  request
) {
  const url =
    getRequestUrl(
      request
    );

  if (!url) {
    return false;
  }

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


/*
--------------------------------------------------
Install
--------------------------------------------------
*/

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
              Promise.allSettled(
                SHELL_ASSETS.map(
                  asset =>
                    cache.add(
                      asset
                    )
                )
              )
          )
      ])
    );
  }
);


/*
--------------------------------------------------
Activate
--------------------------------------------------
*/

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
                    key => {
                      if (
                        key ===
                        CACHE_NAME
                      ) {
                        return false;
                      }

                      if (
                        key.startsWith(
                          CACHE_PREFIX
                        )
                      ) {
                        return true;
                      }

                      return LEGACY_CACHE_PREFIXES
                        .some(
                          prefix =>
                            key.startsWith(
                              prefix
                            )
                        );
                    }
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


/*
--------------------------------------------------
Fetch
--------------------------------------------------
*/

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
     * Do not interfere with third-party/provider
     * requests. The root worker only handles
     * UniBridge same-origin resources.
     */
    if (
      !isSameOriginRequest(
        event.request
      )
    ) {
      return;
    }

    /*
     * Connect owns its own deployment lifecycle.
     *
     * It remains part of the UniBridge app/TWA,
     * but the root worker must not intercept its
     * HTML, JavaScript, CSS or assets.
     */
    if (
      isConnectRequest(
        event.request
      )
    ) {
      return;
    }

    /*
     * Network first.
     *
     * UniBridge is not an offline financial app.
     * Cached shell resources are used only when
     * the live network request fails.
     */
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
