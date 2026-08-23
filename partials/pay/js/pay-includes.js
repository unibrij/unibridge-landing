// partials/pay/js/pay-includes.js

(function () {
  function loadStylesheetOnce(
    href
  ) {
    if (
      document.querySelector(
        `link[href="${href}"]`
      )
    ) {
      return;
    }

    const link =
      document.createElement(
        "link"
      );

    link.rel =
      "stylesheet";

    link.href =
      href;

    document.head.appendChild(
      link
    );
  }

  async function loadPartial(
    targetId,
    url
  ) {
    const target =
      document.getElementById(
        targetId
      );

    if (!target) {
      return;
    }

    const response =
      await fetch(
        url,
        {
          cache:
            "no-cache"
        }
      );

    if (!response.ok) {
      throw new Error(
        `Partial load failed: ${url}`
      );
    }

    const html =
      await response.text();

    if (!html.trim()) {
      throw new Error(
        `Partial empty: ${url}`
      );
    }

    target.innerHTML =
      html;
  }

  async function initPayPartials() {
    loadStylesheetOnce(
      "/partials/pay/css/pay-common.css?v=11"
    );

    loadStylesheetOnce(
      "/partials/pay/css/pay-history.css?v=2"
    );

    await Promise.all([
      loadPartial(
        "pay-brand",
        "/partials/pay/brand.html"
      ),

      loadPartial(
        "pay-history",
        "/partials/pay/history.html"
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
  }

  function start() {
    initPayPartials()
      .catch(
        error => {
          console.error(
            "PAY_PARTIALS_INIT_ERROR",
            error
          );
        }
      );
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      start,
      {
        once:
          true
      }
    );
  }
  else {
    start();
  }
})();
