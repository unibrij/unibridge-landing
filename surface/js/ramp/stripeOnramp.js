// unibrij/unibridge-landing/surface/js/ramp/stripeOnramp.js

window.UnibridgeStripeOnramp = (() => {
  const STRIPE_CORE_SRC =
    "https://js.stripe.com/clover/stripe.js";

  const STRIPE_ONRAMP_SRC =
    "https://crypto-js.stripe.com/crypto-onramp-outer.js";


  function loadScriptOnce(
    src,
    globalName
  ) {
    return new Promise((resolve, reject) => {
      if (
        globalName &&
        window[globalName]
      ) {
        resolve(true);
        return;
      }

      const existing =
        Array.from(document.scripts)
          .find(
            (script) =>
              script.src ===
              new URL(
                src,
                document.baseURI
              ).href
          );

      if (existing) {
        if (
          globalName &&
          window[globalName]
        ) {
          resolve(true);
          return;
        }

        existing.addEventListener(
          "load",
          () => {
            if (
              globalName &&
              !window[globalName]
            ) {
              reject(
                new Error(
                  "script_global_missing"
                )
              );
              return;
            }

            resolve(true);
          },
          {
            once: true
          }
        );

        existing.addEventListener(
          "error",
          () => {
            reject(
              new Error(
                "script_load_failed"
              )
            );
          },
          {
            once: true
          }
        );

        return;
      }

      const script =
        document.createElement("script");

      script.src = src;
      script.async = true;

      script.onload = () => {
        if (
          globalName &&
          !window[globalName]
        ) {
          reject(
            new Error(
              "script_global_missing"
            )
          );
          return;
        }

        resolve(true);
      };

      script.onerror = () => {
        reject(
          new Error(
            "script_load_failed"
          )
        );
      };

      document.head.appendChild(
        script
      );
    });
  }


  function getContainer() {
    let container =
      document.getElementById(
        "stripeOnrampContainer"
      );

    if (container) {
      return container;
    }

    const statusBox =
      document.getElementById(
        "status"
      );

    container =
      document.createElement(
        "div"
      );

    container.id =
      "stripeOnrampContainer";

    container.style.width =
      "100%";

    container.style.minHeight =
      "620px";

    container.style.marginTop =
      "16px";

    container.style.borderRadius =
      "20px";

    container.style.overflow =
      "hidden";

    if (statusBox?.parentNode) {
      statusBox.parentNode.insertBefore(
        container,
        statusBox
      );
    } else {
      document.body.appendChild(
        container
      );
    }

    return container;
  }


  async function ensureSdk() {
    await loadScriptOnce(
      STRIPE_CORE_SRC,
      "Stripe"
    );

    await loadScriptOnce(
      STRIPE_ONRAMP_SRC,
      "StripeOnramp"
    );

    if (
      typeof window.StripeOnramp !==
      "function"
    ) {
      throw new Error(
        "stripe_onramp_sdk_missing"
      );
    }
  }


  async function mount(
    ctx,
    action
  ) {
    const meta =
      action?.meta || {};

    const clientSecret =
      typeof meta.client_secret ===
      "string"
        ? meta.client_secret.trim()
        : "";

    const publishableKey =
      typeof meta.publishable_key ===
      "string"
        ? meta.publishable_key.trim()
        : "";

    if (!clientSecret) {
      throw new Error(
        "missing_stripe_onramp_client_secret"
      );
    }

    if (!publishableKey) {
      throw new Error(
        "missing_stripe_publishable_key"
      );
    }

    await ensureSdk();

    const container =
      getContainer();

    container.innerHTML =
      "";

    ctx.setContinueDisabled(true);

    ctx.setStatus(
      "Opening Stripe payment..."
    );

    const stripeOnramp =
      window.StripeOnramp(
        publishableKey
      );

    const session =
      stripeOnramp.createSession({
        clientSecret,

        appearance: {
          theme: "dark"
        }
      });

    if (
      !session ||
      typeof session.mount !==
        "function"
    ) {
      throw new Error(
        "stripe_onramp_session_mount_missing"
      );
    }

    if (
      typeof session.addEventListener ===
      "function"
    ) {
      session.addEventListener(
        "onramp_session_updated",
        (event) => {
          const stripeSession =
            event?.payload?.session ||
            null;

          const status =
            stripeSession?.status ||
            null;

          console.log(
            "STRIPE_ONRAMP_SESSION_UPDATED",
            {
              status,

              session_id:
                stripeSession?.id ||
                null
            }
          );

          if (
            status ===
            "fulfillment_complete"
          ) {
            ctx.emit(
              "unibridge:payment"
            );

            ctx.setStatus(
              "Payment submitted. Waiting for on-chain confirmation..."
            );

            return;
          }

          if (
            status ===
            "rejected"
          ) {
            ctx.setContinueDisabled(
              false
            );

            ctx.setStatus(
              "Stripe payment was not completed.",
              "error"
            );

            return;
          }

          ctx.setStatus(
            "Complete the payment in the Stripe widget."
          );
        }
      );
    }

    session.mount(
      "#stripeOnrampContainer"
    );

    ctx.emit(
      "unibridge:quote"
    );

    ctx.emit(
      "unibridge:payment"
    );

    ctx.setStatus(
      "Complete the payment in the Stripe widget."
    );

    return true;
  }


  return {
    mount
  };
})();
