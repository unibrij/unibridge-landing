// pay/js/pay-agent-chat-handoff-renderers.js

window.UnibridgePayAgentChatHandoffRenderers = (() => {
  const Core =
    window.UnibridgePayAgentChatRendererCore;

  if (!Core) {
    throw new Error("Pay Agent renderer core is not loaded.");
  }

  const STRIPE_JS_URL =
    "https://js.stripe.com/clover/stripe.js";

  const STRIPE_CRYPTO_URL =
    "https://crypto-js.stripe.com/crypto-onramp-outer.js";

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const existing =
        document.querySelector(
          `script[src="${src}"]`
        );

      if (existing) {
        if (existing.dataset.loaded === "true") {
          resolve();
          return;
        }

        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const script =
        document.createElement("script");

      script.src =
        src;

      script.async =
        true;

      script.onload =
        () => {
          script.dataset.loaded = "true";
          resolve();
        };

      script.onerror =
        reject;

      document.head.appendChild(script);
    });
  }

  async function loadStripeOnrampScripts() {
    await loadScriptOnce(STRIPE_JS_URL);
    await loadScriptOnce(STRIPE_CRYPTO_URL);
  }

  async function mountStripeEmbeddedOnramp({
    container,
    clientSecret,
    publishableKey,
    handoff
  } = {}) {
    if (!container || !clientSecret || !publishableKey) {
      return false;
    }

    if (
      window.UnibridgeStripeOnramp &&
      typeof window.UnibridgeStripeOnramp.mount === "function"
    ) {
      await window.UnibridgeStripeOnramp.mount({
        container,
        client_secret: clientSecret,
        publishable_key: publishableKey,
        handoff
      });

      return true;
    }

    await loadStripeOnrampScripts();

    if (typeof window.StripeOnramp !== "function") {
      return false;
    }

    const stripeOnramp =
      window.StripeOnramp(publishableKey);

    if (
      !stripeOnramp ||
      typeof stripeOnramp.createSession !== "function"
    ) {
      return false;
    }

    const onrampSession =
      stripeOnramp.createSession({
        clientSecret,
        appearance: {
          theme: "dark"
        }
      });

    if (
      !onrampSession ||
      typeof onrampSession.mount !== "function"
    ) {
      return false;
    }

    onrampSession.mount(container);

    return true;
  }

  function renderCardCheckout(result = {}) {
    const Dom =
      Core.getDom();

    if (!Dom) {
      return null;
    }

    const data =
      Core.normalizeObject(result);

    const meta =
      Core.normalizeObject(
        data.next_action?.meta
      );

    const clientSecret =
      Core.normalizeString(
        data.client_secret ||
          meta.client_secret
      );

    const publishableKey =
      Core.normalizeString(
        data.publishable_key ||
          meta.publishable_key
      );

    const card =
      Core.createElement(
        "div",
        "pay-agent-info-panel pay-agent-card-checkout"
      );

    card.appendChild(
      Core.createElement(
        "div",
        "pay-agent-info-panel-title",
        "Card checkout"
      )
    );

    card.appendChild(
      Core.createElement(
        "div",
        "pay-agent-info-panel-row",
        "Complete the card checkout below."
      )
    );

    const mount =
      Core.createElement(
        "div",
        "pay-agent-stripe-onramp"
      );

    mount.dataset.clientSecret =
      clientSecret;

    mount.dataset.publishableKey =
      publishableKey;

    card.appendChild(mount);
    Dom.appendToMessages(card);

    mountStripeEmbeddedOnramp({
      container: mount,
      clientSecret,
      publishableKey,
      handoff: data
    })
      .then((mounted) => {
        if (!mounted) {
          mount.appendChild(
            Core.createElement(
              "div",
              "pay-agent-action-meta",
              "Stripe embedded checkout could not be mounted."
            )
          );
        }
      })
      .catch(() => {
        mount.appendChild(
          Core.createElement(
            "div",
            "pay-agent-action-meta",
            "Unable to mount Stripe checkout. Please try again."
          )
        );
      });

    return card;
  }

  function renderBankTransferInstructions(result = {}) {
    const Dom =
      Core.getDom();

    if (!Dom) {
      return null;
    }

    const data =
      Core.normalizeObject(result);

    const nextAction =
      Core.normalizeObject(data.next_action);

    const instructions =
      Core.normalizeObject(
        data.source_deposit_instructions ||
          nextAction.instructions
      );

    const card =
      Core.createElement(
        "div",
        "pay-agent-info-panel pay-agent-bank-transfer"
      );

    card.appendChild(
      Core.createElement(
        "div",
        "pay-agent-info-panel-title",
        "Bank transfer instructions"
      )
    );

    Core.appendSummaryRow(card, "Provider", data.provider || "Bridge");
    Core.appendSummaryRow(card, "Rail", data.source_rail);
    Core.appendSummaryRow(card, "Currency", data.source_currency);

    Object.entries(instructions).forEach(([key, value]) => {
      Core.appendSummaryRow(
        card,
        key.replace(/_/g, " "),
        value
      );
    });

    Dom.appendToMessages(card);

    return card;
  }

  return {
    mountStripeEmbeddedOnramp,
    renderCardCheckout,
    renderBankTransferInstructions
  };
})();
