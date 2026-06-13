(function () {
  function loadStylesheetOnce(href) {
    const existing = document.querySelector(`link[href="${href}"]`);
    if (existing) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  async function loadPartial(targetId, url, options = {}) {
    const target = document.getElementById(targetId);
    if (!target) return;

    const {
      fallback = null,
      onLoaded = null
    } = options;

    try {
      const response = await fetch(url, {
        cache: "no-cache"
      });

      if (!response.ok) {
        throw new Error(`Partial load failed: ${url}`);
      }

      const html = await response.text();

      if (!html || !html.trim()) {
        throw new Error(`Partial empty: ${url}`);
      }

      target.innerHTML = html;

      if (typeof onLoaded === "function") {
        onLoaded(target);
      }
    } catch (error) {
      console.error(error);

      if (typeof fallback === "function") {
        fallback(target);
      }
    }
  }

  function initPayPartials() {
    loadStylesheetOnce("/partials/pay/css/pay-common.css?v=9");

    loadPartial("pay-brand", "/partials/pay/brand.html");

    loadPartial("pay-footer", "/partials/pay/footer.html");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPayPartials);
  } else {
    initPayPartials();
  }
})();
