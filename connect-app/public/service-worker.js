// connect-app/public/service-worker.js

const CONNECT_CACHE_PREFIX =
  "unibridge-connect-";


self.addEventListener(
  "install",
  event => {
    /*
     * Activate this version immediately.
     *
     * Connect must not keep an old application shell
     * alive across deployments.
     */
    event.waitUntil(
      self.skipWaiting()
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
                        CONNECT_CACHE_PREFIX
                      )
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
