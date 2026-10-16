
// unibridge-landing/receive/receive-public.js

import {
  resolveReceiveProfile,
  buildReceiveContext
} from "/shared/receive/receive.js";

import {
  setReceiveContext
} from "/shared/receive/receive-context.js";

import {
  formatRailLabel
} from "./receive-catalog.js";


// Public publishing flags only. Never use admin credentials in the Landing.
const UI_MODULES_URL =
  "https://unibridge-v2-1066944028362.us-central1.run.app/v2/options/ui-modules";


function normalizeString(value) {
  return String(value ?? "").trim();
}

function setHidden(element, hidden) {
  if (!element) return;
  element.hidden = Boolean(hidden);
}

function goTo(path) {
  window.location.assign(path);
}


export function createReceivePublicFlow({
  showOnly
} = {}) {
  const els = {
    recipient:
      document.getElementById(
        "receivePublicRecipient"
      ),

    country:
      document.getElementById(
        "receivePublicCountry"
      ),

    rail:
      document.getElementById(
        "receivePublicRail"
      ),

    error:
      document.getElementById(
        "receivePublicError"
      ),

    fiatButton:
      document.getElementById(
        "receivePublicFiatButton"
      ),

    walletButton:
      document.getElementById(
        "receivePublicWalletButton"
      ),

    agentButton:
      document.getElementById(
        "receivePublicAgentButton"
      )
  };

  let profile = null;
  let eventsBound = false;

  const uiOptions = [
    ["surface", els.fiatButton],
    ["wallet", els.walletButton],
    ["agent", els.agentButton]
  ];


  async function applyUiModules() {
    // Keep entry buttons hidden until publishing states are known.
    for (const [, button] of uiOptions) {
      setHidden(button, true);
      if (button) button.disabled = true;
    }

    let modules = null;

    try {
      const response = await fetch(UI_MODULES_URL, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(3000)
      });

      if (response.ok) {
        const data = await response.json();

        if (data?.ok === true && data.modules) {
          modules = data.modules;
        }
      }
    } catch {
      // Preserve original options if settings cannot be read.
      console.warn("UI_MODULES_UNAVAILABLE");
    } finally {
      for (const [moduleId, button] of uiOptions) {
        const value = modules?.[moduleId];
        const published =
          typeof value === "boolean" ? value : true;

        setHidden(button, !published);

        if (button) {
          button.disabled = !published;
        }
      }
    }
  }


  function clearError() {
    if (!els.error) return;

    els.error.textContent = "";

    setHidden(
      els.error,
      true
    );
  }


  function showError(message) {
    if (!els.error) return;

    els.error.textContent =
      normalizeString(message) ||
      "Unable to load receive link.";

    setHidden(
      els.error,
      false
    );
  }


  function renderProfile() {
    if (!profile) return;

    if (els.recipient) {
      const recipient =
        profile.recipient || {};

      const label =
        normalizeString(
          recipient.label
        );

      const maskedIdentifier =
        normalizeString(
          recipient.masked_identifier
        );

      els.recipient.textContent =
        [label, maskedIdentifier]
          .filter(Boolean)
          .join(" · ") ||
        "Recipient";
    }

    if (els.country) {
      els.country.textContent =
        profile.country;
    }

    if (els.rail) {
      els.rail.textContent =
        formatRailLabel(
          profile.payout_rail
        );
    }
  }


  function writeContext() {
    if (!profile) {
      throw new Error(
        "Receive profile unavailable."
      );
    }

    const context =
      buildReceiveContext(
        profile
      );

    return setReceiveContext(
      context
    );
  }


  function continueTo(path) {
    if (!profile) {
      return;
    }

    writeContext();
    goTo(path);
  }


  function bindEvents() {
    if (eventsBound) {
      return;
    }

    eventsBound = true;

    els.fiatButton
      ?.addEventListener(
        "click",
        () => {
          continueTo(
            "/surface"
          );
        }
      );

    els.walletButton
      ?.addEventListener(
        "click",
        () => {
          continueTo(
            "/connect"
          );
        }
      );

    els.agentButton
      ?.addEventListener(
        "click",
        () => {
          continueTo(
            "/pay/agent/"
          );
        }
      );
  }


  async function init(token) {
    void applyUiModules();

    showOnly?.(
      "receivePublicView"
    );

    clearError();
    bindEvents();

    try {
      profile =
        await resolveReceiveProfile(
          token
        );

      if (
        profile.status &&
        profile.status !== "active"
      ) {
        throw new Error(
          "This receive link is no longer available."
        );
      }

      renderProfile();
    }
    catch (error) {
      profile = null;

      showError(
        error?.message ||
        "Unable to load receive link."
      );

      throw error;
    }
  }


  return {
    init
  };
}
