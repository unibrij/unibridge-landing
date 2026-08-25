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

function init() {
  getEl("walletOption")
    ?.addEventListener("click", () => {
      goTo("/connect");
    });

  getEl("fiatOption")
    ?.addEventListener("click", () => {
      goTo("/surface");
    });

  getEl("guideCardAction")
    ?.addEventListener("click", () => {
      openPayAgent();
    });
}

init();
