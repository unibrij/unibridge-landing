// unibrij/unibridge-landing/surface/core/coinsPhPickerBootstrap.js

/*
--------------------------------------------------
CoinsPH Picker Bootstrap

Purpose:
- keep CoinsPH picker initialization outside app.js
- create picker only when factory exists
- wire picker callbacks to app callbacks
- avoid payment/session/route logic here

Notes:
- This module does not build destination payloads.
- This module does not create settlements.
- This module does not create funding sessions.
- This module does not touch Brazil / SmartPay.
--------------------------------------------------
*/

function call(fn, ...args) {
  if (typeof fn !== "function") {
    return null;
  }

  return fn(...args);
}

function resolveFactory(factory) {
  if (typeof factory === "function") {
    return factory;
  }

  if (
    typeof window !== "undefined" &&
    typeof window.createCoinsPhPicker === "function"
  ) {
    return window.createCoinsPhPicker;
  }

  return null;
}

export function createSurfaceCoinsPhPicker({
  factory,
  root,
  continueBtn,
  setStatus,
  refreshAmountLimitUi,
  updateDestinationFields,
  getDestinationCountryCode
} = {}) {
  const createPicker =
    resolveFactory(factory);

  if (!createPicker) {
    return null;
  }

  const picker =
    createPicker({
      root,
      continueBtn,

      onReady() {
        call(refreshAmountLimitUi);
      },

      onChange() {
        call(refreshAmountLimitUi);
      },

      onValid() {
        call(refreshAmountLimitUi);
      },

      onInvalid() {
        call(refreshAmountLimitUi);
      },

      onError(error) {
        const message =
          error?.message ||
          "Could not load Philippines payout options";

        call(
          setStatus,
          message,
          "error"
        );
      },

      getDestinationCountryCode
    });

  if (
    picker &&
    typeof picker.mount === "function"
  ) {
    picker.mount();
  }

  call(updateDestinationFields);

  return picker || null;
}

export function refreshCoinsPhPicker(picker) {
  if (
    picker &&
    typeof picker.refresh === "function"
  ) {
    picker.refresh();
    return true;
  }

  return false;
}
