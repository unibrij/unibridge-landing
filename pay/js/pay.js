
// pay/js/pay.js

const UNIBRIDGE_PAY_AGENT_URL =
  "/pay/agent/";

const UI_MODULES_URL =
  "https://unibridge-v2-1066944028362.us-central1.run.app/v2/options/ui-modules";

const UI_OPTIONS = [
  ["wallet", "walletOption"],
  ["surface", "fiatOption"],
  ["agent", "guideCardAction"]
];

function getEl(id) {
  return document.getElementById(id);
}

function goTo(path) {
  window.location.assign(path);
}

function openPayAgent() {
  goTo(UNIBRIDGE_PAY_AGENT_URL);
}

async function applyUiModules() {
  try {
    const response = await fetch(UI_MODULES_URL, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(3000)
    });

    if (!response.ok) return;

    const data = await response.json();
    if (data?.ok !== true || !data.modules) return;

    for (const [moduleId, elementId] of UI_OPTIONS) {
      const published = data.modules[moduleId];
      const element = getEl(elementId);

      if (!element || typeof published !== "boolean") continue;

      element.classList.toggle("hidden", !published);
      element.disabled = !published;
    }
  } catch {
    // If the public settings API is unavailable, keep the current Pay options.
    console.warn("UI_MODULES_UNAVAILABLE");
  } finally {
    document.documentElement.classList.remove(
      "ui-modules-loading"
    );
  }
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

  void applyUiModules();
}

init();
