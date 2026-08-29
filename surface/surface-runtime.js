// unibridge-landing/surface/surface-runtime.js

export function createSurfaceRuntime({
  statusBox
} = {}) {
  const {
    apiGet,
    apiPost
  } =
    window.UnibridgeApi ||
    {};

  const {
    resetStatusMemory,
    setStatus:
      setStatusInternal,
    handleSettlementStatus
  } =
    window.UnibridgeStatus ||
    {};

  const {
    normalizeNextAction,
    extractWidgetUrlFromFunding
  } =
    window.UnibridgeNextAction ||
    {};

  const {
    isPostFundingSettlementStatus
  } =
    window.UnibridgeSettlementViewState ||
    {};

  if (
    typeof apiGet !==
      "function" ||
    typeof apiPost !==
      "function" ||
    typeof setStatusInternal !==
      "function"
  ) {
    throw new Error(
      "surface_runtime_missing"
    );
  }

  function emit(
    name
  ) {
    window.dispatchEvent(
      new Event(
        name
      )
    );
  }

  function setStatus(
    message,
    type
  ) {
    setStatusInternal(
      statusBox,
      message,
      type
    );
  }

  function getValue(
    id
  ) {
    return document.getElementById(
      id
    );
  }

  function resetUiToStart() {
    window.resetUiToStart?.();
  }

  return {
    apiGet,
    apiPost,

    resetStatusMemory,
    setStatus,
    handleSettlementStatus,

    normalizeNextAction,
    extractWidgetUrlFromFunding,
    isPostFundingSettlementStatus,

    emit,
    getValue,
    resetUiToStart
  };
}
