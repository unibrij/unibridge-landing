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
