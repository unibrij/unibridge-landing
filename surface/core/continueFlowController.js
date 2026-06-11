// unibrij/unibridge-landing/surface/core/continueFlowController.js

/*
--------------------------------------------------
Surface Continue Flow Controller

Purpose:
- keep continueFlow orchestration outside app.js
- validate runtime flow state through callback
- build destination through callback
- create settlement through callback
- create/open funding session through callback
- update UI state through callbacks

Notes:
- This module does not know Brazil / SmartPay.
- This module does not build destination payloads.
- This module does not create settlement directly.
- This module does not create funding session directly.
- It delegates all business actions to injected callbacks.
--------------------------------------------------
*/

function call(fn, ...args) {
  if (typeof fn !== "function") {
    return null;
  }

  return fn(...args);
}

function requireFunction(fn, name) {
  if (typeof fn !== "function") {
    throw new Error(`${name}_missing`);
  }

  return fn;
}

function requireValue(value, name) {
  if (!value) {
    throw new Error(`${name}_missing`);
  }

  return value;
}

export async function continueSurfaceFlow({
  apiPost,

  sessionId,
  routeId,
  settlementId,
  currentRouteQuote,

  ensureFlowCanContinue,
  buildDestinationPayload,
  createSurfaceSettlement,
  createAndOpenFundingSession,

  getSourceCountryCode,
  buildFundingReturnUrl,

  setSettlementId,
  persistSettlement,
  markPaymentStarted,
  setCurrentFundingProvider,

  setStatus,
  setContinueButtonMode,
  setContinueButtonsDisabled,
  refreshAmountLimitUi,
  emit
} = {}) {
  requireFunction(apiPost, "api_post");
  requireFunction(ensureFlowCanContinue, "ensure_flow_can_continue");
  requireFunction(buildDestinationPayload, "build_destination_payload");
  requireFunction(createSurfaceSettlement, "create_surface_settlement");
  requireFunction(createAndOpenFundingSession, "create_funding_session");
  requireFunction(getSourceCountryCode, "get_source_country");
  requireFunction(buildFundingReturnUrl, "build_funding_return_url");

  call(
    setContinueButtonsDisabled,
    true
  );

  call(
    setStatus,
    "Preparing payment...",
    "info"
  );

  ensureFlowCanContinue({
    sessionId,
    routeId,
    currentRouteQuote
  });

  const destination =
    buildDestinationPayload();

  if (!settlementId) {
    const created =
      await createSurfaceSettlement({
        apiPost,

        sessionId,
        routeId,

        destination,

        currentRouteQuote,

        persistSettlement
      });

    const createdSettlementId =
      requireValue(
        created?.settlementId,
        "settlement_id"
      );

    call(
      setSettlementId,
      createdSettlementId
    );

    settlementId =
      createdSettlementId;
  }

  call(
    setContinueButtonMode,
    "open_payment"
  );

  call(
    setStatus,
    "Opening payment page...",
    "info"
  );

  await createAndOpenFundingSession({
    apiPost,

    sessionId,

    settlementId:
      requireValue(
        settlementId,
        "settlement_id"
      ),

    amount:
      currentRouteQuote.requested_amount,

    sourceCountry:
      getSourceCountryCode(),

    returnUrl:
      buildFundingReturnUrl(sessionId),

    setCurrentFundingProvider,

    markPaymentStarted
  });

  call(refreshAmountLimitUi);

  call(
    emit,
    "unibridge:payment-opened"
  );

  return {
    settlementId,
    destination
  };
}
