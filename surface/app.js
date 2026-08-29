// unibridge-landing/surface/app.js

import {
  buildKycPayload as buildGenericKycPayload
} from "./kyc-payload.js";

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
  createQuoteFlow
} from "./quote-flow.js";

import {
  createPaymentFlow
} from "./payment-flow.js";

import {
  createSurfaceRuntime
} from "./surface-runtime.js";

import {
  createSurfaceContext
} from "./surface-context.js";

import {
  createSurfaceDestination
} from "./surface-destination.js";

import {
  createSurfaceReceiveView
} from "./receive-view.js";


let initPromise = null;


/* =========================
   INIT
========================= */

async function init() {
  /* =========================
     PLATFORM
  ========================= */

  const tg = window.Telegram?.WebApp;

  if (tg) {
    tg.expand();
  }


  /* =========================
     UI
  ========================= */

  const sendBtn =
    document.getElementById(
      "sendBtn"
    );

  const continueBtn =
    document.getElementById(
      "continueBtn"
    );

  const coinsPhContinueBtn =
    document.getElementById(
      "coinsPhContinueBtn"
    );

  const signBtn =
    document.getElementById(
      "signBtn"
    );

  const statusBox =
    document.getElementById(
      "status"
    );

  const quoteBox =
    document.getElementById(
      "quoteBox"
    );

  const destinationFieldsContainer =
    document.getElementById(
      "destinationFields"
    );

  if (
    !sendBtn ||
    !statusBox ||
    !quoteBox ||
    !destinationFieldsContainer
  ) {
    throw new Error(
      "surface_app_mount_missing"
    );
  }

  if (signBtn) {
    signBtn.disabled = true;
    signBtn.style.display = "none";
  }

  if (coinsPhContinueBtn) {
    coinsPhContinueBtn.disabled = true;
  }


  /* =========================
     RUNTIME
  ========================= */

  const runtime =
    createSurfaceRuntime({
      statusBox
    });

  const {
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
  } = runtime;


  /* =========================
     FLOW REFERENCES
  ========================= */

  let surfaceContext = null;
  let quoteFlow = null;


  /* =========================
     COUNTRY
  ========================= */

  const {
    isPhilippinesDestination,
    getCountryLabel,
    getSourceCountryCode
  } =
    createCountryHelpers({
      getValue,

      getDestinationCountry() {
        return surfaceContext
          ?.getReceiveDestinationCountry();
      }
    });


  /* =========================
     CONTINUE BUTTONS
  ========================= */

  const {
    getActiveContinueButton,
    setContinueButtonsDisabled,
    setContinueButtonMode
  } =
    createContinueButtons({
      continueBtn,
      coinsPhContinueBtn,
      isPhilippinesDestination,

      isReceiveBound() {
        return Boolean(
          surfaceContext
            ?.receiveBound
        );
      }
    });


  /* =========================
     FUNDING UI RESET
  ========================= */

  function resetFundingProviderUi() {
    const providers = [
      window.UnibridgeStripeOnramp,
      window.UnibridgeOnrampMoney
    ];

    for (const provider of providers) {
      try {
        provider?.reset?.();
      }
      catch (error) {
        console.warn(
          "FUNDING_PROVIDER_RESET_FAILED",
          error
        );
      }
    }
  }


  /* =========================
     SURFACE CONTEXT
  ========================= */

  surfaceContext =
    createSurfaceContext({
      getValue,
      signBtn,
      sendBtn,

      setContinueButtonsDisabled,
      setContinueButtonMode,

      resetFundingProviderUi
    });

  const {
    state,
    receiveBound,
    receiveContext,

    buildSessionDestinationInput,
    buildSettlementDestinationInput,

    setCurrentFundingProvider
  } = surfaceContext;


  /* =========================
     RECEIVE VIEW
  ========================= */

  const receiveView =
    createSurfaceReceiveView({
      receiveBound,
      receiveContext,
      getValue
    });

  receiveView.apply();


  /* =========================
     DESTINATION
  ========================= */

  const destination =
    createSurfaceDestination({
      container:
        destinationFieldsContainer,

      continueBtn,
      coinsPhContinueBtn,

      apiGet,

      isPhilippinesDestination,
      receiveBound,

      getQuoteFlow() {
        return quoteFlow;
      }
    });

  const {
    buildDestinationPayload,
    renderDestinationRoute,
    clearDestinationRoute,
    syncGenericDestinationContinueState
  } = destination;


  /* =========================
     SHARED RESET BOUNDARY
  ========================= */

  function resetFlowState() {
    surfaceContext
      .resetSurfaceContext();

    quoteFlow
      ?.resetQuoteState();

    receiveView.apply();
  }


  /* =========================
     SURFACE HELPERS
  ========================= */

  function getCustomerPaymentCurrency() {
    return (
      getValue(
        "amountCurrency"
      )
        ?.textContent
        ?.trim() ||
      "USD"
    );
  }


  function buildKycPayload() {
    return buildGenericKycPayload({
      telegramUser:
        tg
          ?.initDataUnsafe
          ?.user,

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

      renderDestinationRoute,
      clearDestinationRoute,
      syncGenericDestinationContinueState,

      getCoinsPhPicker() {
        return destination
          .getCoinsPhPicker();
      },

      receiveBound,
      buildSessionDestinationInput
    });


  /* =========================
     PAYMENT FLOW
  ========================= */

  const paymentFlow =
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
        return destination
          .getCoinsPhPicker();
      },

      receiveBound,
      buildSettlementDestinationInput,

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

  quoteFlow
    .bindRouteInputEvents();

  paymentFlow
    .bindLifecycleEvents();


  sendBtn.onclick =
    quoteFlow.startFlow;

  if (continueBtn) {
    continueBtn.onclick =
      paymentFlow.continueFlow;
  }

  if (coinsPhContinueBtn) {
    coinsPhContinueBtn.onclick =
      paymentFlow.continueFlow;
  }
}


/* =========================
   PUBLIC INIT
========================= */

export function initSurface() {
  if (!initPromise) {
    initPromise =
      init()
        .catch(
          error => {
            initPromise = null;
            throw error;
          }
        );
  }

  return initPromise;
}
