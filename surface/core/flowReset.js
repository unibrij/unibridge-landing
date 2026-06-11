// unibrij/unibridge-landing/surface/core/flowReset.js

/*
--------------------------------------------------
Surface Flow Reset

Purpose:
- keep reset/cleanup side effects outside app.js
- clear persisted settlement state
- reset runtime state through callbacks
- reset UI through callback
- refresh amount limit UI after reset

Notes:
- This module does not create settlements.
- This module does not open payment links.
- This module does not touch Brazil / SmartPay.
--------------------------------------------------
*/

function call(fn, ...args) {
  if (typeof fn !== "function") {
    return null;
  }

  return fn(...args);
}

export function resetSurfaceFlow({
  clearFlowState,
  resetRuntimeState,
  resetUiToStart,
  setAmountInputDisabled,
  refreshAmountLimitUi,
  emit
} = {}) {
  call(clearFlowState);

  call(resetRuntimeState);

  call(resetUiToStart);

  call(
    setAmountInputDisabled,
    false
  );

  call(refreshAmountLimitUi);

  call(
    emit,
    "unibridge:flow-reset"
  );

  return true;
}
