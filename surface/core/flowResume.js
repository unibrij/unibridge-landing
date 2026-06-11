// unibrij/unibridge-landing/surface/core/flowResume.js

/*
--------------------------------------------------
Surface Flow Resume

Purpose:
- keep funding-return / persisted-settlement resume logic outside app.js
- decide whether a previous settlement should be resumed
- call refresh settlement state through callback
- cleanup funding return URL through callback
- reset abandoned funding return when needed

Notes:
- This module does not create settlements.
- This module does not create funding sessions.
- This module does not pick routes.
- This module does not touch Brazil / SmartPay.
--------------------------------------------------
*/

function call(fn, ...args) {
  if (typeof fn !== "function") {
    return null;
  }

  return fn(...args);
}

function normalizeString(value) {
  return String(value || "")
    .trim();
}

function getPersistedSettlementId(persisted = {}) {
  return normalizeString(
    persisted.id ||
      persisted.settlement_id ||
      persisted.settlementId
  );
}

function wasPaymentStarted(persisted = {}) {
  return Boolean(
    persisted.payment_started ||
      persisted.paymentStarted
  );
}

export async function resumeSurfaceFlow({
  getSessionIdFromUrl,
  isFundingReturn,
  cleanupFundingReturnUrl,
  getPersistedSettlement,
  setSettlementId,
  refreshSettlementState,
  clearState,
  setStatus
} = {}) {
  const sessionIdFromUrl =
    call(getSessionIdFromUrl);

  const fundingReturn =
    Boolean(
      call(isFundingReturn)
    );

  const persisted =
    call(getPersistedSettlement);

  const persistedSettlementId =
    getPersistedSettlementId(persisted);

  /*
  --------------------------------------------------
  If user returned from provider but we do not have
  a persisted settlement, reset stale return params.
  --------------------------------------------------
  */

  if (
    fundingReturn &&
    sessionIdFromUrl &&
    !persistedSettlementId
  ) {
    call(cleanupFundingReturnUrl);
    call(clearState);
    return null;
  }

  if (!persistedSettlementId) {
    return null;
  }

  if (!wasPaymentStarted(persisted)) {
    return null;
  }

  if (typeof setSettlementId === "function") {
    setSettlementId(persistedSettlementId);
  }

  call(
    setStatus,
    "Checking payment status...",
    "info"
  );

  const status =
    typeof refreshSettlementState === "function"
      ? await refreshSettlementState()
      : null;

  if (fundingReturn) {
    call(cleanupFundingReturnUrl);
  }

  return {
    settlementId:
      persistedSettlementId,

    status,
    fundingReturn,
    sessionIdFromUrl
  };
}
