// unibrij/unibridge-landing/surface/js/ramp/onrampMoney.js

window.UnibridgeOnrampMoney = (() => {
  const ONRAMP_WEB_SDK_SRC =
    "https://cdn.jsdelivr.net/npm/@onramp.money/onramp-web-sdk@2.0.1/dist/onramp-web-sdk.umd.js";

  const SCRIPT_LOAD_TIMEOUT_MS = 15000;

  let activeInstance = null;
  let sdkLoadPromise = null;


  function getSdkConstructor() {
    return typeof window.OnrampWebSDK === "function"
      ? window.OnrampWebSDK
      : null;
  }


  function loadSdkScript() {
    const existingConstructor =
      getSdkConstructor();

    if (existingConstructor) {
      return Promise.resolve(
        existingConstructor
      );
    }

    if (sdkLoadPromise) {
      return sdkLoadPromise;
    }

    sdkLoadPromise = new Promise((resolve, reject) => {
      const absoluteSrc =
        new URL(
          ONRAMP_WEB_SDK_SRC,
          document.baseURI
        ).href;

      let script =
        Array.from(document.scripts)
          .find((item) => item.src === absoluteSrc) ||
        null;

      let settled = false;
      let timeoutId = null;


      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        if (script) {
          script.removeEventListener(
            "load",
            onLoad
          );

          script.removeEventListener(
            "error",
            onError
          );
        }
      };


      const finish = (
        error = null,
        Constructor = null
      ) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();

        if (error) {
          reject(error);
          return;
        }

        resolve(Constructor);
      };


      const verifySdk = () => {
        const Constructor =
          getSdkConstructor();

        if (!Constructor) {
          finish(
            new Error(
              "onramp_web_sdk_missing"
            )
          );

          return;
        }

        if (script) {
          script.dataset.unibridgeLoaded =
            "true";
        }

        finish(
          null,
          Constructor
        );
      };


      const onLoad = () => {
        queueMicrotask(
          verifySdk
        );
      };


      const onError = () => {
        finish(
          new Error(
            "onramp_sdk_script_load_failed"
          )
        );
      };


      /*
      If this script was previously loaded by UniBridge
      but the expected constructor is still missing,
      fail immediately instead of waiting another 15s.
      */
      if (
        script?.dataset?.unibridgeLoaded ===
        "true"
      ) {
        finish(
          new Error(
            "onramp_web_sdk_missing"
          )
        );

        return;
      }


      timeoutId = setTimeout(() => {
        const Constructor =
          getSdkConstructor();

        if (Constructor) {
          finish(
            null,
            Constructor
          );

          return;
        }

        finish(
          new Error(
            "onramp_sdk_script_timeout"
          )
        );
      }, SCRIPT_LOAD_TIMEOUT_MS);


      if (script) {
        script.addEventListener(
          "load",
          onLoad,
          {
            once: true
          }
        );

        script.addEventListener(
          "error",
          onError,
          {
            once: true
          }
        );

        /*
        Close the race where the script finishes between
        our initial constructor check and listener setup.
        */
        queueMicrotask(() => {
          const Constructor =
            getSdkConstructor();

          if (Constructor) {
            finish(
              null,
              Constructor
            );
          }
        });

        return;
      }


      script =
        document.createElement(
          "script"
        );

      script.src =
        ONRAMP_WEB_SDK_SRC;

      script.async =
        true;

      script.dataset.unibridgeOnrampSdk =
        "true";

      script.addEventListener(
        "load",
        onLoad,
        {
          once: true
        }
      );

      script.addEventListener(
        "error",
        onError,
        {
          once: true
        }
      );

      document.head.appendChild(
        script
      );
    });

    sdkLoadPromise =
      sdkLoadPromise.finally(() => {
        sdkLoadPromise = null;
      });

    return sdkLoadPromise;
  }


  async function ensureSdk() {
    const Constructor =
      getSdkConstructor();

    if (Constructor) {
      return Constructor;
    }

    return loadSdkScript();
  }


  function requirePositiveNumber(
    value,
    errorCode
  ) {
    const parsed =
      Number(value);

    if (
      !Number.isFinite(parsed) ||
      parsed <= 0
    ) {
      throw new Error(
        errorCode
      );
    }

    return parsed;
  }


  function requireString(
    value,
    errorCode
  ) {
    const normalized =
      String(value || "").trim();

    if (!normalized) {
      throw new Error(
        errorCode
      );
    }

    return normalized;
  }


  function resolveNetwork(value) {
    const network =
      requireString(
        value,
        "missing_onramp_network"
      ).toLowerCase();

    const map = {
      polygon: "polygon",
      matic: "polygon",
      matic20: "polygon",
      "polygon-pos": "polygon",
      tron: "tron",
      trc20: "tron"
    };

    const resolved =
      map[network];

    if (!resolved) {
      throw new Error(
        "unsupported_onramp_sdk_network"
      );
    }

    return resolved;
  }


  function buildSdkOptions(meta = {}) {
    return {
      appId: requirePositiveNumber(
        meta.app_id,
        "missing_onramp_app_id"
      ),

      walletAddress: requireString(
        meta.wallet_address,
        "missing_onramp_wallet_address"
      ),

      flowType: requirePositiveNumber(
        meta.flow_type,
        "missing_onramp_flow_type"
      ),

      fiatAmount: requirePositiveNumber(
        meta.fiat_amount,
        "missing_onramp_fiat_amount"
      ),

      paymentMethod: requirePositiveNumber(
        meta.payment_method,
        "missing_onramp_payment_method"
      ),

      coinCode: requireString(
        meta.coin_code,
        "missing_onramp_coin_code"
      ).toUpperCase(),

      network:
        resolveNetwork(
          meta.network
        )
    };
  }


  function closeActiveInstance() {
    const instance =
      activeInstance;

    activeInstance = null;

    if (
      !instance ||
      typeof instance.close !== "function"
    ) {
      return;
    }

    try {
      instance.close();
    } catch (error) {
      console.warn(
        "ONRAMP_SDK_CLOSE_FAILED",
        error
      );
    }
  }


  function reset() {
    closeActiveInstance();
  }


  function resolveEventType(event) {
    return String(
      event?.type || ""
    )
      .trim()
      .toUpperCase();
  }


  function attachEvents(
    ctx,
    instance
  ) {
    if (
      !instance ||
      typeof instance.on !== "function"
    ) {
      return;
    }

    instance.on(
      "TX_EVENTS",
      (event) => {
        if (
          activeInstance !== instance
        ) {
          return;
        }

        const type =
          resolveEventType(event);

        console.log(
          "ONRAMP_TX_EVENT",
          {
            type,
            data:
              event?.data || null
          }
        );

        if (
          type ===
          "ONRAMP_WIDGET_TX_INITIATED"
        ) {
          ctx.setStatus(
            "Complete the payment in Onramp."
          );

          return;
        }

        if (
          type ===
          "ONRAMP_WIDGET_TX_SUCCESSFUL"
        ) {
          ctx.emit(
            "unibridge:payment"
          );

          ctx.setContinueDisabled(
            true
          );

          ctx.setStatus(
            "Payment submitted. Waiting for on-chain confirmation..."
          );

          return;
        }

        if (
          type ===
          "ONRAMP_WIDGET_TX_FAILED"
        ) {
          ctx.setContinueDisabled(
            false
          );

          ctx.setStatus(
            "Payment was not completed. Tap Continue to try again.",
            "error"
          );
        }
      }
    );

    instance.on(
      "WIDGET_EVENTS",
      (event) => {
        if (
          activeInstance !== instance
        ) {
          return;
        }

        const type =
          resolveEventType(event);

        console.log(
          "ONRAMP_WIDGET_EVENT",
          {
            type
          }
        );

        if (
          type ===
          "ONRAMP_WIDGET_READY"
        ) {
          ctx.setStatus(
            "Complete the payment in Onramp."
          );

          return;
        }

        if (
          type ===
          "ONRAMP_WIDGET_FAILED"
        ) {
          activeInstance =
            null;

          ctx.setContinueDisabled(
            false
          );

          ctx.setStatus(
            "Unable to open Onramp. Tap Continue to try again.",
            "error"
          );

          return;
        }

        if (
          type ===
          "ONRAMP_WIDGET_CLOSE_REQUEST_CONFIRMED"
        ) {
          activeInstance =
            null;

          ctx.setContinueDisabled(
            false
          );

          ctx.setStatus(
            "Payment window closed. Tap Continue to reopen it."
          );
        }
      }
    );
  }


  async function mount(
    ctx,
    action
  ) {
    const options =
      buildSdkOptions(
        action?.meta || {}
      );

    const OnrampWebSDK =
      await ensureSdk();

    closeActiveInstance();

    ctx.setContinueDisabled(
      true
    );

    ctx.setStatus(
      "Opening bank payment..."
    );

    const instance =
      new OnrampWebSDK(
        options
      );

    if (
      !instance ||
      typeof instance.show !== "function"
    ) {
      throw new Error(
        "onramp_sdk_instance_invalid"
      );
    }

    activeInstance =
      instance;

    attachEvents(
      ctx,
      instance
    );

    try {
      instance.show();
    } catch (error) {
      if (
        activeInstance === instance
      ) {
        activeInstance =
          null;
      }

      ctx.setContinueDisabled(
        false
      );

      throw error;
    }

    ctx.emit(
      "unibridge:quote"
    );

    ctx.emit(
      "unibridge:payment"
    );

    ctx.setStatus(
      "Complete the payment in Onramp."
    );

    return true;
  }


  return {
    mount,
    reset
  };
})();
