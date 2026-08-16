// pay-by-bank/js/flow/reviewLifecycle.js

import {
  getState,
  setSessionId,
  clearQuoteState,
  setSettlementId,
  setTransactionId,
  setPaymentLink,
  setStatus as setFlowStatus,
  setError
} from "../state.js";

import {
  hideRouteSummary,
  clearDestinationFields,
  hideDestinationFields,
  hideConfirmAction,
  setConfirmEnabled,
  setContinueBusy,
  setPrimaryBusy,
  setPrimaryEnabled,
  clearStatus,
  resetSteps
} from "../ui.js";

import {
  clearCanonicalPricing
} from "./pricing.js";

import {
  clearReturnIdentity
} from "./returnIdentity.js";


let reviewGeneration =
  0;


export function beginReview() {
  reviewGeneration +=
    1;

  setSessionId(
    null
  );

  clearQuoteState();

  clearReturnIdentity();

  return reviewGeneration;
}


export function isCurrentReview(
  generation
) {
  return (
    generation ===
    reviewGeneration
  );
}


export function invalidateReview() {
  reviewGeneration +=
    1;

  setSessionId(
    null
  );

  clearQuoteState();

  setFlowStatus(
    "idle"
  );

  setError(
    null
  );

  hideRouteSummary();

  clearCanonicalPricing();

  clearDestinationFields();

  hideDestinationFields();

  hideConfirmAction();

  setConfirmEnabled(
    false
  );

  /*
  An input change can invalidate an in-flight
  review. Its stale finally block intentionally
  cannot unlock the current button state.
  */

  setContinueBusy(
    false
  );

  setPrimaryBusy(
    false
  );

  setPrimaryEnabled(
    false
  );

  clearStatus();

  resetSteps();

  clearReturnIdentity();
}


export function invalidateSettlementForDestinationChange() {
  const state =
    getState();

  if (
    !state.settlementId &&
    !state.transactionId &&
    !state.paymentLink
  ) {
    return;
  }

  /*
  Destination is immutable settlement input.

  Changing recipient details keeps the route and
  quote valid, but invalidates the settlement and
  all provider funding state derived from it.
  */

  setSettlementId(
    null
  );

  setTransactionId(
    null
  );

  setPaymentLink(
    null
  );

  clearReturnIdentity();

  setPrimaryBusy(
    false
  );

  setPrimaryEnabled(
    false
  );

  setFlowStatus(
    "preview_ready"
  );
}
