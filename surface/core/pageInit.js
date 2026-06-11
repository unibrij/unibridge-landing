// unibrij/unibridge-landing/surface/core/pageInit.js

/*
--------------------------------------------------
Surface Page Init

Purpose:
- keep page boot sequence outside app.js
- run URL prefill
- initialize buttons
- initialize destination UI
- initialize amount limit UI
- initialize CoinsPH picker
- bind form events
- resume existing flow when needed

Notes:
- This module does not create sessions.
- This module does not create settlements.
- This module does not create funding sessions.
- This module does not pick routes.
- This module does not touch Brazil / SmartPay.
--------------------------------------------------
*/

function call(fn, ...args) {
  if (typeof fn !== "function") {
    return null;
  }

  return fn(...args);
}

export async function initializeSurfacePage({
  applyUrlPrefill,
  initSignButton,
  initCoinsPhContinueButton,
  signBtn,
  coinsPhContinueBtn,

  initCoinsPhPicker,
  updateDestinationFields,
  refreshAmountLimitUi,
  bindEvents,
  resumeFlow,
  setStatus
} = {}) {
  call(applyUrlPrefill);

  call(
    initSignButton,
    signBtn
  );

  call(
    initCoinsPhContinueButton,
    coinsPhContinueBtn
  );

  call(initCoinsPhPicker);

  call(updateDestinationFields);

  call(refreshAmountLimitUi);

  call(bindEvents);

  try {
    await call(resumeFlow);
  } catch (error) {
    call(
      setStatus,
      error?.message ||
        "Could not resume payment flow",
      "error"
    );
  }

  return true;
}

export function bindSurfacePageReady(callback) {
  if (typeof callback !== "function") {
    return false;
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      callback,
      {
        once:
          true
      }
    );

    return true;
  }

  callback();
  return true;
}
