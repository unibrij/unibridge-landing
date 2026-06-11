// unibrij/unibridge-landing/surface/core/flowError.js

/*
--------------------------------------------------
Surface Flow Error

Purpose:
- keep user-facing flow error handling outside app.js
- normalize thrown errors
- render status message through callback
- re-enable continue buttons when needed
- refresh amount limit UI after failure

Notes:
- This module does not create settlements.
- This module does not create funding sessions.
- This module does not pick routes.
- This module does not touch Brazil / SmartPay.
--------------------------------------------------
*/

function normalizeErrorMessage(error, fallback) {
  const message =
    error?.message ||
    error?.error ||
    error?.code ||
    fallback;

  return String(
    message ||
      "Something went wrong"
  );
}

function call(fn, ...args) {
  if (typeof fn !== "function") {
    return null;
  }

  return fn(...args);
}

export function handleSurfaceFlowError({
  error,
  fallbackMessage = "Something went wrong",
  setStatus,
  setContinueButtonsDisabled,
  refreshAmountLimitUi,
  emit,
  eventName = "unibridge:flow-error",
  reenableContinue = true
} = {}) {
  const message =
    normalizeErrorMessage(
      error,
      fallbackMessage
    );

  call(
    setStatus,
    message,
    "error"
  );

  if (reenableContinue) {
    call(
      setContinueButtonsDisabled,
      false
    );
  }

  call(refreshAmountLimitUi);

  call(
    emit,
    eventName
  );

  return {
    message,
    error
  };
}

export function getErrorMessage(error, fallbackMessage) {
  return normalizeErrorMessage(
    error,
    fallbackMessage
  );
}
