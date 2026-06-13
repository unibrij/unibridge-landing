(function () {
  function loadStylesheetOnce(href) {
    const existing = document.querySelector(`link[href="${href}"]`);
    if (existing) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  async function loadPartial(targetId, url) {
    const target = document.getElementById(targetId);
    if (!target) return;

    try {
      const response = await fetch(url, {
        cache: "no-cache"
      });

      if (!response.ok) {
        throw new Error(`Partial load failed: ${url}`);
      }

      target.innerHTML = await response.text();
    } catch (error) {
      console.error(error);
    }
  }

  function initPayPartials() {
    loadStylesheetOnce("/partials/pay/css/pay-common.css?v=3");

    loadPartial("pay-brand", "/partials/pay/brand.html");
    loadPartial("pay-footer", "/partials/pay/footer.html");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPayPartials);
  } else {
    initPayPartials();
  }
})();
