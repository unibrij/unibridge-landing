// unibridge-landing/surface/app.js

import {
  buildKycPayload as buildGenericKycPayload
} from "./kyc-payload.js";

import {
  clearPersistedSurfaceSettlement
} from "./storage.js";

import {
  createCoinsPhPicker
} from "/shared/coinsph/coinsph-picker.js";

import {
  setupSurfacePwaInstall
} from "./pwa-install.js";

import {
  createCountryHelpers
} from "./country.js";

import {
  createContinueButtons
} from "./continue-buttons.js";

import {
  createDestinationPayloadBuilders
} from "./destination-payload.js";

import {
  createQuoteFlow
} from "./quote-flow.js";

import {
  createPaymentFlow
} from "./payment-flow.js";


/* =========================
   PLATFORM
========================= */

const tg =
  window.Telegram?.WebApp;

if (tg) {
  tg.expand();
}


/* =========================
   SHARED STATE
========================= */

const state = {
  sessionId: null,
  routeId: null,
  settlementId: null,

  pendingWidgetUrl: null,
  currentNextAction: null,
  currentFundingProvider: null,

  processing: false,
  nextActionProcessing: false,

  currentRouteQuote: null,
  paymentStarted: false
};


/* =========================
   UI
========================= */

const sendBtn =
  document.getElementById("sendBtn");

const continueBtn =
  document.getElementById("continueBtn");

const coinsPhContinueBtn =
  document.getElementById(
    "coinsPhContinueBtn"
  );

const signBtn =
  document.getElementById("signBtn");

const statusBox =
  document.getElementById("status");

const quoteBox =
  document.getElementById("quoteBox");


if (signBtn) {
  signBtn.disabled = true;
  signBtn.style.display = "none";
}

if (coinsPhContinueBtn) {
  coinsPhContinueBtn.disabled = true;
}


/* =========================
   GLOBAL SERVICES
========================= */

const {
  apiGet,
  apiPost
} = window.UnibridgeApi;

const {
  resetStatusMemory,
  setStatus: setStatusInternal,
  handleSettlementStatus
} = window.UnibridgeStatus;

const {
  normalizeNextAction,
  extractWidgetUrlFromFunding
} = window.UnibridgeNextAction;

const {
  isPostFundingSettlementStatus
} = window.UnibridgeSettlementViewState;


/* =========================
   BASIC HELPERS
========================= */

function emit(name) {
  window.dispatchEvent(
    new Event(name)
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


function getValue(id) {
  return document.getElementById(
    id
  );
}


function resetUiToStart() {
  window.resetUiToStart?.();
}


function getCustomerPaymentCurrency() {
  return (
    getValue("amountCurrency")
      ?.textContent
      ?.trim() ||
    "USD"
  );
}


function setCurrentFundingProvider(
  value
) {
  if (!value) {
    return;
  }

  state.currentFundingProvider =
    value;
}


/* =========================
   COUNTRY
========================= */

const {
  isPhilippinesDestination,
  isBrazilDestination,
  getCountryLabel,
  getSourceCountryCode
} = createCountryHelpers({
  getValue
});


/* =========================
   CONTINUE BUTTONS
========================= */

const {
  getActiveContinueButton,
  setContinueButtonsDisabled,
  setContinueButtonMode
} = createContinueButtons({
  continueBtn,
  coinsPhContinueBtn,
  isPhilippinesDestination
});


/* =========================
   FLOW REFERENCES
========================= */

let quoteFlow = null;
let paymentFlow = null;
let coinsPhPicker = null;


/* =========================
   RESET BOUNDARY
========================= */

function resetFundingProviderUi() {
  const providers = [
    window.UnibridgeStripeOnramp,
    window.UnibridgeOnrampMoney
  ];

  for (const provider of providers) {
    try {
      provider?.reset?.();
    } catch (error) {
      console.warn(
        "FUNDING_PROVIDER_RESET_FAILED",
        error
      );
    }
  }
}


function resetFlowState() {
  /*
  Provider UI must be torn down before clearing the
  canonical local flow state.

  This prevents an old Stripe iframe or Onramp overlay
  from surviving a new quote.
  */
  resetFundingProviderUi();

  state.sessionId = null;
  state.routeId = null;
  state.settlementId = null;

  state.pendingWidgetUrl = null;
  state.currentNextAction = null;
  state.currentFundingProvider = null;

  state.processing = false;
  state.nextActionProcessing = false;

  state.currentRouteQuote = null;
  state.paymentStarted = false;

  clearPersistedSurfaceSettlement();

  quoteFlow?.resetQuoteState();

  const amountInput =
    getValue("amount");

  if (amountInput) {
    amountInput.disabled = false;
  }

  if (signBtn) {
    signBtn.disabled = true;
  }

  setContinueButtonsDisabled(
    true
  );

  if (sendBtn) {
    sendBtn.disabled = false;
  }

  setContinueButtonMode(
    "prepare_payment"
  );
}


/* =========================
   KYC
========================= */

function buildKycPayload() {
  return buildGenericKycPayload({
    telegramUser:
      tg?.initDataUnsafe?.user,

    sourceCountry:
      getSourceCountryCode()
  });
}


/* =========================
   QUOTE FLOW
========================= */

quoteFlow =
  createQuoteFlow({
    state,

    elements: {
      sendBtn,
      continueBtn,
      quoteBox
    },

    apiPost,
    getValue,
    emit,
    setStatus,

    resetUiToStart,
    resetStatusMemory,
    resetFlowState,

    setCurrentFundingProvider,

    getCountryLabel,
    getSourceCountryCode,
    getCustomerPaymentCurrency,

    getActiveContinueButton,
    setContinueButtonsDisabled,
    setContinueButtonMode,

    isPhilippinesDestination,

    getCoinsPhPicker() {
      return coinsPhPicker;
    }
  });


/* =========================
   COINSPH PICKER
========================= */

coinsPhPicker =
  createCoinsPhPicker({
    loadChannelOptions:
      async () => {
        const response =
          await apiGet(
            "options/coinsph/ph-payout-channels",
            {}
          );

        if (!response?.ok) {
          throw new Error(
            response?.error ||
            "COINSPH_CHANNELS_LOAD_FAILED"
          );
        }

        if (Array.isArray(response)) {
          return response;
        }

        if (
          Array.isArray(
            response.options
          )
        ) {
          return response.options;
        }

        if (
          Array.isArray(
            response.channels
          )
        ) {
          return response.channels;
        }

        if (
          Array.isArray(
            response.data
          )
        ) {
          return response.data;
        }

        return [];
      },

    isPhilippinesDestination,

    setContinueDisabled(value) {
      if (!coinsPhContinueBtn) {
        return;
      }

      coinsPhContinueBtn.disabled =
        Boolean(value) ||
        !quoteFlow
          .isCurrentRouteAmountAvailable();
    }
  });

coinsPhPicker.bindEvents();


/* =========================
   DESTINATION
========================= */

const {
  buildDestinationPayload
} = createDestinationPayloadBuilders({
  getValue,

  getCoinsPhPicker() {
    return coinsPhPicker;
  },

  isPhilippinesDestination,
  isBrazilDestination
});


/* =========================
   PAYMENT FLOW
========================= */

paymentFlow =
  createPaymentFlow({
    state,

    elements: {
      continueBtn,
      signBtn
    },

    apiGet,
    apiPost,

    emit,
    setStatus,

    resetFlowState,
    resetUiToStart,
    resetStatusMemory,

    setCurrentFundingProvider,

    getActiveContinueButton,
    setContinueButtonMode,

    isPhilippinesDestination,
    buildDestinationPayload,
    buildKycPayload,

    getCoinsPhPicker() {
      return coinsPhPicker;
    },

    handleSettlementStatus,
    normalizeNextAction,
    extractWidgetUrlFromFunding,
    isPostFundingSettlementStatus,

    quoteFlow
  });


/* =========================
   PWA
========================= */

setupSurfacePwaInstall({
  setStatus
});


/* =========================
   EVENT WIRING
========================= */

quoteFlow.bindRouteInputEvents();
paymentFlow.bindLifecycleEvents();


if (sendBtn) {
  sendBtn.onclick =
    quoteFlow.startFlow;
}

if (continueBtn) {
  continueBtn.onclick =
    paymentFlow.continueFlow;
}

if (coinsPhContinueBtn) {
  coinsPhContinueBtn.onclick =
    paymentFlow.continueFlow;
}
