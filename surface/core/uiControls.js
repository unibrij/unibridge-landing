// unibrij/unibridge-landing/surface/core/uiControls.js

/*
--------------------------------------------------
Surface UI Controls

Purpose:
- keep common UI button/status helpers outside app.js
- centralize continue button state
- centralize status rendering
- centralize event emission
- avoid route/provider/payment logic here

Notes:
- This module does not decide routes.
- This module does not build destinations.
- This module does not touch Brazil / SmartPay.
--------------------------------------------------
*/

function getElement(id) {
  if (!id) {
    return null;
  }

  return document.getElementById(id);
}

function resolveElement(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return getElement(value);
  }

  return value;
}

export function emitSurfaceEvent(name) {
  if (!name) {
    return false;
  }

  try {
    window.dispatchEvent(
      new Event(name)
    );

    return true;
  } catch {
    return false;
  }
}

export function setSurfaceStatus({
  statusBox,
  message,
  type,
  setStatusInternal
} = {}) {
  if (typeof setStatusInternal !== "function") {
    return false;
  }

  setStatusInternal(
    resolveElement(statusBox),
    message,
    type
  );

  return true;
}

export function initSignButton(signBtn) {
  const button =
    resolveElement(signBtn);

  if (!button) {
    return false;
  }

  button.disabled = true;
  button.style.display = "none";

  return true;
}

export function initCoinsPhContinueButton(button) {
  const resolved =
    resolveElement(button);

  if (!resolved) {
    return false;
  }

  resolved.disabled = true;

  return true;
}

export function getActiveContinueButton({
  isPhilippinesDestination,
  continueBtn,
  coinsPhContinueBtn
} = {}) {
  const isPh =
    typeof isPhilippinesDestination === "function"
      ? isPhilippinesDestination()
      : false;

  return isPh
    ? resolveElement(coinsPhContinueBtn)
    : resolveElement(continueBtn);
}

export function setContinueButtonsDisabled({
  disabled,
  continueBtn,
  coinsPhContinueBtn
} = {}) {
  const value =
    Boolean(disabled);

  const mainButton =
    resolveElement(continueBtn);

  const phButton =
    resolveElement(coinsPhContinueBtn);

  if (mainButton) {
    mainButton.disabled = value;
  }

  if (phButton) {
    phButton.disabled = value;
  }
}

export function setContinueButtonMode({
  mode,
  continueBtn,
  coinsPhContinueBtn
} = {}) {
  const label =
    mode === "prepare_payment"
      ? "Prepare payment"
      : mode === "open_payment"
        ? "Continue to payment"
        : "Continue";

  const mainButton =
    resolveElement(continueBtn);

  const phButton =
    resolveElement(coinsPhContinueBtn);

  if (mainButton) {
    mainButton.innerText = label;
  }

  if (phButton) {
    phButton.innerText = label;
  }

  return label;
}

export function setButtonDisabled(button, disabled) {
  const resolved =
    resolveElement(button);

  if (!resolved) {
    return false;
  }

  resolved.disabled =
    Boolean(disabled);

  return true;
}

export function resetSurfaceUiToStart() {
  if (typeof window.resetUiToStart === "function") {
    window.resetUiToStart();
    return true;
  }

  return false;
}
