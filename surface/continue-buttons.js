// unibridge-landing/surface/continue-buttons.js

export function createContinueButtons({
  continueBtn,
  coinsPhContinueBtn,
  isPhilippinesDestination,
  isReceiveBound
} = {}) {
  function getActiveContinueButton() {
    const useCoinsPhButton =
      Boolean(
        isPhilippinesDestination?.()
      ) &&
      !Boolean(
        isReceiveBound?.()
      );

    return useCoinsPhButton
      ? coinsPhContinueBtn
      : continueBtn;
  }

  function setContinueButtonsDisabled(disabled) {
    const value =
      Boolean(disabled);

    if (continueBtn) {
      continueBtn.disabled = value;
    }

    if (coinsPhContinueBtn) {
      coinsPhContinueBtn.disabled = value;
    }
  }

  function setContinueButtonMode(mode) {
    const label =
      mode === "prepare_payment"
        ? "Prepare payment"
        : mode === "open_payment"
          ? "Continue to payment"
          : "Continue";

    if (continueBtn) {
      continueBtn.innerText = label;
    }

    if (coinsPhContinueBtn) {
      coinsPhContinueBtn.innerText = label;
    }
  }

  return {
    getActiveContinueButton,
    setContinueButtonsDisabled,
    setContinueButtonMode
  };
}
