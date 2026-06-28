// pay/js/pay.js

const UNIBRIDGE_PAY_AGENT_URL =
  "/pay/agent/";

function getEl(id) {
  return document.getElementById(id);
}

function goTo(path) {
  window.location.assign(path);
}

function openPayAgent() {
  goTo(
    UNIBRIDGE_PAY_AGENT_URL
  );
}

function showChoice() {
  getEl("choiceCard")?.classList.remove("hidden");
  getEl("fiatCard")?.classList.add("hidden");
  getEl("guideCard")?.classList.remove("hidden");
}

function showFiat() {
  getEl("choiceCard")?.classList.add("hidden");
  getEl("fiatCard")?.classList.remove("hidden");
  getEl("guideCard")?.classList.add("hidden");
}

function getPaymentMethod() {
  return (
    document.querySelector(
      'input[name="paymentMethod"]:checked'
    )?.value || "bank_transfer"
  );
}

function redirectByPaymentMethod(paymentMethod) {
  if (paymentMethod === "bank_transfer") {
    goTo("/fiat/bank-transfer");
    return;
  }

  if (paymentMethod === "ramp") {
    goTo("/surface");
    return;
  }

  goTo("/surface");
}

function init() {
  getEl("walletOption")
    ?.addEventListener("click", () => {
      goTo("/connect");
    });

  getEl("fiatOption")
    ?.addEventListener("click", () => {
      showFiat();
    });

  getEl("backAction")
    ?.addEventListener("click", () => {
      showChoice();
    });

  getEl("guideCardAction")
    ?.addEventListener("click", () => {
      openPayAgent();
    });

  getEl("fiatForm")
    ?.addEventListener("submit", event => {
      event.preventDefault();

      redirectByPaymentMethod(
        getPaymentMethod()
      );
    });

  showChoice();
}

init();
