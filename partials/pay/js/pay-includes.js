(function () {
  const UNIBRIDGE_GUIDE_URL =
    "https://chatgpt.com/g/g-6a2bbad960e08191b39185eafbc55948-unibridge-official-guide";

  function loadStylesheetOnce(href) {
    const existing = document.querySelector(`link[href="${href}"]`);
    if (existing) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  function renderGuideLink(target) {
    if (!target) return;

    target.innerHTML = `
      <div class="pay-guide-link-wrap">
        <a
          href="${UNIBRIDGE_GUIDE_URL}"
          class="pay-guide-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          Need help? Open UniBridge Guide
        </a>
      </div>
    `;
  }

  function normalizeGuideLink(target) {
    if (!target) return;

    const link = target.querySelector(".pay-guide-link");
    if (!link) {
      renderGuideLink(target);
      return;
    }

    link.href = UNIBRIDGE_GUIDE_URL;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
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

    loadPartial("pay-guide", "/partials/pay/guide-link.html", {
      fallback: renderGuideLink,
      onLoaded: normalizeGuideLink
    });

    loadPartial("pay-footer", "/partials/pay/footer.html");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPayPartials);
  } else {
    initPayPartials();
  }
})();
