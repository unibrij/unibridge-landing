// pay-by-bank/js/flow/paymentController.js

import {
  getState,
  setSettlementId,
  setTransactionId,
  setPaymentLink,
  setStatus as setFlowStatus,
  setError
} from "../state.js";

import {
  showEntry,
  showPreparation,
  showConfirmAction,
  setStatus,
  setStepState,
  resetSteps,
  setConfirmBusy,
  setConfirmEnabled,
  setPrimaryBusy,
  setPrimaryEnabled,
  setBackEnabled
} from "../ui.js";

import {
  normalizeString
} from "./normalization.js";

import {
  collectSelectedDestination
} from "./destination.js";

import {
  ensureSettlement,
  prepareFundingRedirect
} from "./funding.js";

import {
  persistReturnIdentity
} from "./returnIdentity.js";


export async function handleConfirmPayment() {
  const state =
    getState();

  const sessionId =
    normalizeString(
      state.sessionId
    );

  const selectedRoute =
    state.selectedRoute;

  if (
    !sessionId ||
    !selectedRoute?.route_id ||
    !state.quote
  ) {
    setStatus(
      "Please review the payment again before continuing.",
      {
        error:
          true
      }
    );

    return;
  }

  setConfirmBusy(
    true
  );

  setConfirmEnabled(
    false
  );

  setBackEnabled(
    false
  );

  setError(
    null
  );

  try {
    /*
    Destination validation happens while the entry
    surface is still visible so field-level errors
    remain visible to the user.
    */

    const destination =
      collectSelectedDestination(
        selectedRoute
      );

    /*
    Destination is now frozen for this settlement.

    Leave the editable entry surface BEFORE the
    settlement request begins.

    Back is also disabled while the mutation is in
    flight so the user cannot return to editable
    inputs and race the settlement creation.
    */

    showPreparation();

    resetSteps();

    setStepState(
      "profile",
      "active"
    );

    setStatus(
      "Preparing your bank payment…"
    );

    setFlowStatus(
      "creating_settlement"
    );

    const settlement =
      await ensureSettlement({
        sessionId,

        routeId:
          selectedRoute
            .route_id,

        destination,

        existingSettlementId:
          state.settlementId
      });

    const settlementId =
      settlement
        .settlementId;

    /*
    Persist canonical identity immediately after
    settlement creation, before provider funding
    preparation.
    */

    setSettlementId(
      settlementId
    );

    persistReturnIdentity({
      settlementId,
      sessionId
    });

    setFlowStatus(
      "preparing_funding"
    );

    const funding =
      await prepareFundingRedirect(
        settlementId
      );

    if (
      funding.transactionId
    ) {
      setTransactionId(
        funding.transactionId
      );
    }

    setPaymentLink(
      funding.redirectUrl
    );

    setStepState(
      "profile",
      "complete"
    );

    setStepState(
      "payment",
      "active"
    );

    setFlowStatus(
      "ready_for_bank"
    );

    setStatus(
      "Your secure bank payment is ready."
    );

    setPrimaryEnabled(
      true
    );

    setBackEnabled(
      true
    );
  } catch (error) {
    console.error(
      "PAY_BY_BANK_CONFIRM_FAILED",
      error
    );

    setError(
      error
    );

    setFlowStatus(
      "payment_preparation_failed"
    );

    /*
    Existing destination validation owns its own
    field-level UI.

    In this case the user must remain able to edit
    the recipient details.
    */

    if (
      error?.handled ===
      true
    ) {
      showEntry();

      setConfirmEnabled(
        true
      );

      setBackEnabled(
        true
      );

      return;
    }

    showPreparation();

    setStatus(
      "Could not prepare the bank payment. Please try again.",
      {
        error:
          true
      }
    );

    setPrimaryEnabled(
      false
    );

    setBackEnabled(
      true
    );
  } finally {
    setConfirmBusy(
      false
    );
  }
}


export function handleOpenBank() {
  const state =
    getState();

  const paymentLink =
    normalizeString(
      state.paymentLink
    );

  if (!paymentLink) {
    setStatus(
      "The bank payment link is not available yet.",
      {
        error:
          true
      }
    );

    setPrimaryEnabled(
      false
    );

    return;
  }

  persistReturnIdentity({
    settlementId:
      state.settlementId,

    sessionId:
      state.sessionId
  });

  setPrimaryBusy(
    true
  );

  setBackEnabled(
    false
  );

  setFlowStatus(
    "redirecting_to_bank"
  );

  setStepState(
    "payment",
    "active"
  );

  window.location.assign(
    paymentLink
  );
}


export function handleBack() {
  setPrimaryBusy(
    false
  );

  setPrimaryEnabled(
    false
  );

  setBackEnabled(
    true
  );

  showEntry();

  const state =
    getState();

  if (
    state.quote &&
    state.selectedRoute
  ) {
    showConfirmAction();

    setConfirmEnabled(
      true
    );
  }
}
