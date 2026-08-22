// unibrij/unibridge-landing/surface/js/ramp/onrampMoney.js

window.UnibridgeOnrampMoney = (() => {
  const ONRAMP_WEB_SDK_SRC =
    "https://cdn.jsdelivr.net/npm/@onramp.money/onramp-web-sdk@2.0.1/dist/onramp-web-sdk.umd.js";

  const SCRIPT_LOAD_TIMEOUT_MS =
    15000;

  let activeInstance =
    null;


  function loadScriptOnce(
    src,
    globalName
  ) {
    return new Promise((resolve, reject) => {
      const hasGlobal = () =>
        Boolean(
          globalName &&
          window[globalName]
        );

      if (hasGlobal()) {
        resolve(true);
        return;
      }

      const absoluteSrc =
        new URL(
          src,
          document.baseURI
        ).href;

      let script =
        Array
          .from(
            document.scripts
          )
          .find(
            (item) =>
              item.src ===
              absoluteSrc
          ) ||
        null;

      let settled =
        false;

      let timeoutId =
        null;


      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(
            timeoutId
          );

          timeoutId =
            null;
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
        error = null
      ) => {
        if (settled) {
          return;
        }

        settled =
          true;

        cleanup();

        if (error) {
          reject(error);
          return;
        }

        resolve(true);
      };


      const verifyGlobal = () => {
        if (!hasGlobal()) {
          finish(
            new Error(
              "script_global_missing"
            )
          );

          return;
        }

        finish();
      };


      const onLoad = () => {
        queueMicrotask(
          verifyGlobal
        );
      };


      const onError = () => {
        finish(
          new Error(
            "script_load_failed"
          )
        );
      };


      timeoutId =
        setTimeout(
          () => {
            if (hasGlobal()) {
              finish();
              return;
            }

            finish(
              new Error(
                "script_load_timeout"
              )
            );
          },
          SCRIPT_LOAD_TIMEOUT_MS
        );


      if (script) {
        if (hasGlobal()) {
          finish();
          return;
        }

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
        Close the race where the script finishes
        between the first global check and listener
        registration.
        */
        queueMicrotask(
          () => {
            if (hasGlobal()) {
              finish();
            }
          }
        );

        return;
      }


      script =
        document.createElement(
          "script"
        );

      script.src =
        src;

      script.async =
        true;

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
      String(
        value || ""
      ).trim();

    if (!normalized) {
      throw new Error(
        errorCode
      );
    }

    return normalized;
  }


  function resolveNetwork(
    value
  ) {
    const network =
      requireString(
        value,
        "missing_onramp_network"
      )
        .toLowerCase();

    const map = {
      polygon:
        "polygon",

      matic:
        "polygon",

      matic20:
        "polygon",

      "polygon-pos":
        "polygon",

      tron:
        "tron",

      trc20:
        "tron"
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


  function buildSdkOptions(
    meta = {}
  ) {
    return {
      appId:
        requirePositiveNumber(
          meta.app_id,
          "missing_onramp_app_id"
        ),

      walletAddress:
        requireString(
          meta.wallet_address,
          "missing_onramp_wallet_address"
        ),

      flowType:
        requirePositiveNumber(
          meta.flow_type,
          "missing_onramp_flow_type"
        ),

      fiatAmount:
        requirePositiveNumber(
          meta.fiat_amount,
          "missing_onramp_fiat_amount"
        ),

      paymentMethod:
        requirePositiveNumber(
          meta.payment_method,
          "missing_onramp_payment_method"
        ),

      coinCode:
        requireString(
          meta.coin_code,
          "missing_onramp_coin_code"
        )
          .toUpperCase(),

      network:
        resolveNetwork(
          meta.network
        )
    };
  }


  async function ensureSdk() {
    if (
      typeof window.OnrampWebSDK ===
      "function"
    ) {
      return;
    }

    await loadScriptOnce(
      ONRAMP_WEB_SDK_SRC,
      "OnrampWebSDK"
    );

    if (
      typeof window.OnrampWebSDK !==
      "function"
    ) {
      throw new Error(
        "onramp_web_sdk_missing"
      );
    }
  }


  function closeActiveInstance() {
    const instance =
      activeInstance;

    activeInstance =
      null;

    if (
      !instance ||
      typeof instance.close !==
        "function"
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


  function resolveEventType(
    event
  ) {
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
      typeof instance.on !==
        "function"
    ) {
      return;
    }

    instance.on(
      "TX_EVENTS",
      (event) => {
        const type =
          resolveEventType(
            event
          );

        console.log(
          "ONRAMP_TX_EVENT",
          {
            type,
            data:
              event?.data ||
              null
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
        const type =
          resolveEventType(
            event
          );

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
          if (
            activeInstance ===
            instance
          ) {
            activeInstance =
              null;
          }

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
          if (
            activeInstance ===
            instance
          ) {
            activeInstance =
              null;
          }

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

    await ensureSdk();

    closeActiveInstance();

    ctx.setContinueDisabled(
      true
    );

    ctx.setStatus(
      "Opening bank payment..."
    );

    const instance =
      new window.OnrampWebSDK(
        options
      );

    if (
      !instance ||
      typeof instance.show !==
        "function"
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
        activeInstance ===
        instance
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
    mount
  };
})();
