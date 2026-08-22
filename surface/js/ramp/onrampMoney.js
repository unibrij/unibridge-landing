// unibrij/unibridge-landing/surface/js/ramp/onrampMoney.js

window.UnibridgeOnrampMoney = (() => {
  const ONRAMP_WEB_SDK_MODULE =
    "https://cdn.skypack.dev/@onramp.money/onramp-web-sdk";

  let activeInstance = null;
  let completedInstance = null;
  let sdkLoadPromise = null;

  const TX_FAILURE_EVENTS = new Set([
    "ONRAMP_WIDGET_TX_SENDING_FAILED",
    "ONRAMP_WIDGET_TX_PURCHASING_FAILED",
    "ONRAMP_WIDGET_TX_FINDING_FAILED"
  ]);


  /* =========================
     SDK
  ========================= */

  async function ensureSdk() {
    if (typeof window.OnrampWebSDK === "function") {
      return window.OnrampWebSDK;
    }

    if (!sdkLoadPromise) {
      sdkLoadPromise = import(ONRAMP_WEB_SDK_MODULE)
        .then((module) => {
          const Constructor = module?.OnrampWebSDK;

          if (typeof Constructor !== "function") {
            throw new Error(
              "onramp_web_sdk_missing"
            );
          }

          window.OnrampWebSDK =
            Constructor;

          return Constructor;
        })
        .catch((error) => {
          sdkLoadPromise = null;
          throw error;
        });
    }

    return sdkLoadPromise;
  }


  /* =========================
     CONFIG
  ========================= */

  function requirePositiveNumber(
    value,
    errorCode
  ) {
    const parsed = Number(value);

    if (
      !Number.isFinite(parsed) ||
      parsed <= 0
    ) {
      throw new Error(errorCode);
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
      throw new Error(errorCode);
    }

    return normalized;
  }


  function buildSdkOptions(meta = {}) {
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

      fiatType:
        requirePositiveNumber(
          meta.fiat_type,
          "missing_onramp_fiat_type"
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
        ).toLowerCase(),

      network:
        requireString(
          meta.network,
          "missing_onramp_network"
        ).toLowerCase(),

      merchantRecognitionId:
        requireString(
          meta.merchant_recognition_id,
          "missing_onramp_merchant_recognition_id"
        ),

      isRestricted: true
    };
  }


  /* =========================
     INSTANCE LIFECYCLE
  ========================= */

  function closeInstance(
    instance,
    warningCode
  ) {
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
        warningCode,
        error
      );
    }
  }


  function closeActiveInstance() {
    const instance =
      activeInstance;

    activeInstance = null;
    completedInstance = null;

    closeInstance(
      instance,
      "ONRAMP_SDK_CLOSE_FAILED"
    );
  }


  function reset() {
    closeActiveInstance();
  }


  /* =========================
     EVENTS
  ========================= */

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
            data: event?.data || null
          }
        );

        if (
          type ===
          "ONRAMP_WIDGET_TX_INIT"
        ) {
          ctx.setStatus(
            "Complete the payment in Onramp."
          );

          return;
        }

        if (
          type === "ONRAMP_WIDGET_TX_FINDING" ||
          type === "ONRAMP_WIDGET_TX_PURCHASING" ||
          type === "ONRAMP_WIDGET_TX_SENDING"
        ) {
          ctx.setContinueDisabled(true);

          ctx.setStatus(
            "Payment received. Processing your transfer..."
          );

          return;
        }

        if (
          type ===
          "ONRAMP_WIDGET_TX_COMPLETED"
        ) {
          ctx.emit(
            "unibridge:payment"
          );

          ctx.setContinueDisabled(true);

          ctx.setStatus(
            "Payment submitted. Waiting for on-chain confirmation..."
          );

          completedInstance =
            instance;

          closeInstance(
            instance,
            "ONRAMP_SDK_CLOSE_AFTER_COMPLETION_FAILED"
          );

          if (
            activeInstance === instance
          ) {
            activeInstance = null;
          }

          return;
        }

        if (
          TX_FAILURE_EVENTS.has(type)
        ) {
          ctx.setContinueDisabled(false);

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
          resolveEventType(event);

        if (
          type ===
            "ONRAMP_WIDGET_CLOSE_REQUEST_CONFIRMED" &&
          completedInstance === instance
        ) {
          completedInstance = null;
          return;
        }

        if (
          activeInstance !== instance
        ) {
          return;
        }

        console.log(
          "ONRAMP_WIDGET_EVENT",
          {
            type,
            data: event?.data || null
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
          activeInstance = null;

          ctx.setContinueDisabled(false);

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
          activeInstance = null;

          ctx.setContinueDisabled(false);

          ctx.setStatus(
            "Payment window closed. Tap Continue to reopen it."
          );
        }
      }
    );
  }


  /* =========================
     MOUNT
  ========================= */

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

    ctx.setContinueDisabled(true);

    ctx.setStatus(
      "Opening bank payment..."
    );

    console.log(
      "ONRAMP_SDK_OPTIONS",
      {
        appId:
          options.appId,

        walletAddress:
          options.walletAddress,

        flowType:
          options.flowType,

        fiatType:
          options.fiatType,

        fiatAmount:
          options.fiatAmount,

        paymentMethod:
          options.paymentMethod,

        coinCode:
          options.coinCode,

        network:
          options.network,

        merchantRecognitionId:
          options.merchantRecognitionId,

        isRestricted:
          options.isRestricted
      }
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
        activeInstance = null;
      }

      completedInstance = null;

      ctx.setContinueDisabled(false);

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
