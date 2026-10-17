
// partials/pay/js/pay-includes.js

(function () {
  "use strict";

  const PAY_COMMON_CSS =
    "/partials/pay/css/pay-common.css?v=12";

  const PAY_HISTORY_CSS =
    "/partials/pay/css/pay-history.css?v=2";

  const PLAY_BANNER_CSS =
    "/shared/app-install/app-install.css?v=1";

  const PLAY_BANNER_JS =
    "/shared/app-install/app-install.js?v=1";

  /* -----------------------------------------
     Load stylesheet once
     Remove duplicate versions
  ----------------------------------------- */

  function loadStylesheetOnce(href) {
    const wanted = new URL(
      href,
      document.baseURI
    );

    const matches = Array.from(
      document.querySelectorAll(
        'link[rel~="stylesheet"]'
      )
    ).filter(link => {
      const current = new URL(
        link.href,
        document.baseURI
      );

      return (
        current.origin === wanted.origin &&
        current.pathname === wanted.pathname
      );
    });

    if (matches.length > 0) {
      const matchingVersion = matches.find(
        link => link.href === wanted.href
      );

      const retained =
        matchingVersion || matches[0];

      if (retained.href !== wanted.href) {
        retained.href = wanted.href;
      }

      matches.forEach(link => {
        if (link !== retained) {
          link.remove();
        }
      });

      return;
    }

    const link =
      document.createElement("link");

    link.rel = "stylesheet";
    link.href = wanted.href;

    document.head.appendChild(link);
  }

  /* -----------------------------------------
     Load HTML partial
  ----------------------------------------- */

  async function loadPartial(
    targetId,
    url
  ) {
    const target =
      document.getElementById(targetId);

    if (!target) {
      return;
    }

    const response = await fetch(
      url,
      {
        cache: "no-cache"
      }
    );

    if (!response.ok) {
      throw new Error(
        `Partial load failed: ${url}`
      );
    }

    const html = await response.text();

    if (!html.trim()) {
      throw new Error(
        `Partial empty: ${url}`
      );
    }

    target.innerHTML = html;
  }

  /* -----------------------------------------
     Load Google Play banner as ES Module
  ----------------------------------------- */

  function loadPlayBannerModuleOnce() {
    if (
      document.querySelector(
        'script[data-ub-play-banner]'
      )
    ) {
      return;
    }

    const script =
      document.createElement("script");

    script.type = "module";
    script.src = PLAY_BANNER_JS;
    script.dataset.ubPlayBanner = "1";

    document.head.appendChild(script);
  }

  /* -----------------------------------------
     Initialize Pay partials
  ----------------------------------------- */

  async function initPayPartials() {
    loadStylesheetOnce(
      PAY_COMMON_CSS
    );

    loadStylesheetOnce(
      PAY_HISTORY_CSS
    );

    loadStylesheetOnce(
      PLAY_BANNER_CSS
    );

    await Promise.all([
      loadPartial(
        "pay-brand",
        "/partials/pay/brand.html"
      ),

      loadPartial(
        "pay-footer",
        "/partials/pay/footer.html"
      )
    ]);

    document.dispatchEvent(
      new CustomEvent(
        "pay-partials-ready"
      )
    );

    /* Start banner after partials are ready. */

    loadPlayBannerModuleOnce();
  }

  /* -----------------------------------------
     Bootstrap
  ----------------------------------------- */

  function start() {
    initPayPartials().catch(error => {
      console.error(
        "PAY_PARTIALS_INIT_ERROR",
        error
      );
    });
  }

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      start,
      {
        once: true
      }
    );
  } else {
    start();
  }
})();
