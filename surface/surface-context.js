// unibridge-landing/surface/surface-context.js

import {
  getReceiveContext,
  buildSessionDestinationInput as buildSharedSessionDestinationInput,
  buildSettlementDestinationInput as buildSharedSettlementDestinationInput
} from "/shared/receive/receive-context.js";

import {
  clearPersistedSurfaceSettlement
} from "./storage.js";


export function createSurfaceContext({
  getValue,
  signBtn,
  sendBtn,
  setContinueButtonsDisabled,
  setContinueButtonMode,
  resetFundingProviderUi
} = {}) {
  /*
  --------------------------------------------------
  Receive snapshot

  Read once for the lifetime of this Surface instance.

  This keeps UI state and outbound payloads bound to
  the same Receive Profile throughout the flow.
  --------------------------------------------------
  */

  const receiveContext =
    getReceiveContext();

  const receiveProfileId =
    receiveContext
      ?.receive_profile_id ||
    null;

  const receiveBound =
    Boolean(
      receiveProfileId
    );


  /*
  --------------------------------------------------
  Canonical Surface state
  --------------------------------------------------
  */

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


  /*
  --------------------------------------------------
  Receive-bound destination
  --------------------------------------------------
  */

  function getReceiveDestinationCountry() {
    return (
      receiveContext
        ?.destination_country ||
      null
    );
  }


  function buildSessionDestinationInput({
    receiver_country
  } = {}) {
    if (receiveBound) {
      return {
        receive_profile_id:
          receiveProfileId
      };
    }

    return buildSharedSessionDestinationInput({
      receiver_country
    });
  }


  function buildSettlementDestinationInput({
    destination
  } = {}) {
    if (receiveBound) {
      return {
        receive_profile_id:
          receiveProfileId
      };
    }

    return buildSharedSettlementDestinationInput({
      destination
    });
  }


  /*
  --------------------------------------------------
  Funding state
  --------------------------------------------------
  */

  function setCurrentFundingProvider(
    value
  ) {
    if (!value) {
      return;
    }

    state.currentFundingProvider =
      value;
  }


  /*
  --------------------------------------------------
  Reset primitives
  --------------------------------------------------
  */

  function resetCanonicalState() {
    state.sessionId =
      null;

    state.routeId =
      null;

    state.settlementId =
      null;

    state.pendingWidgetUrl =
      null;

    state.currentNextAction =
      null;

    state.currentFundingProvider =
      null;

    state.processing =
      false;

    state.nextActionProcessing =
      false;

    state.currentRouteQuote =
      null;

    state.paymentStarted =
      false;
  }


  function resetBaseUiState() {
    const amountInput =
      getValue?.(
        "amount"
      );

    if (amountInput) {
      amountInput.disabled =
        false;
    }

    if (signBtn) {
      signBtn.disabled =
        true;
    }

    setContinueButtonsDisabled?.(
      true
    );

    if (sendBtn) {
      sendBtn.disabled =
        false;
    }

    setContinueButtonMode?.(
      "prepare_payment"
    );
  }


  function resetSurfaceContext() {
    resetFundingProviderUi?.();

    resetCanonicalState();

    clearPersistedSurfaceSettlement();

    resetBaseUiState();
  }


  return {
    state,

    receiveContext,
    receiveBound,

    getReceiveDestinationCountry,
    buildSessionDestinationInput,
    buildSettlementDestinationInput,

    setCurrentFundingProvider,

    resetCanonicalState,
    resetBaseUiState,
    resetSurfaceContext
  };
}
