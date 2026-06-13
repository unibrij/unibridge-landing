(function () {
  function loadStylesheetOnce(href) {
    const existing = document.querySelector(`link[href="${href}"]`);
    if (existing) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  function renderGuideFallback(target) {
    if (!target) return;

    target.innerHTML = `
      <div class="pay-guide-link-wrap">
        <a
          href="/guide"
          class="pay-guide-link"
        >
          Need help? Open UniBridge Guide
        </a>
      </div>
    `;
  }

  async function loadPartial(targetId, url, fallback) {
    const target = document.getElementById(targetId);
    if (!target) return;

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
    } catch (error) {
      console.error(error);

      if (typeof fallback === "function") {
        fallback(target);
      }
    }
  }

  function initPayPartials() {
    loadStylesheetOnce("/partials/pay/css/pay-common.css?v=8");

    loadPartial("pay-brand", "/partials/pay/brand.html");

    loadPartial(
      "pay-guide",
      "/partials/pay/guide-link.html",
      renderGuideFallback
    );

    loadPartial("pay-footer", "/partials/pay/footer.html");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPayPartials);
  } else {
    initPayPartials();
  }
})();
