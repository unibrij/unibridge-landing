// pay-by-bank/js/flow/reviewController.js

import {
  setSourceCountry,
  setReceiverCountry,
  setAmount,
  setPhoneNumber,
  setCurrency,
  setSessionId,
  setSelectedRoute,
  setQuote,
  clearQuoteState,
  setStatus as setFlowStatus,
  setError
} from "../state.js";

import {
  readEntryForm,
  validateEntryForm,
  renderRouteSummary,
  hideRouteSummary,
  clearDestinationFields,
  hideDestinationFields,
  showConfirmAction,
  hideConfirmAction,
  setStatus,
  clearStatus,
  setContinueBusy,
  setConfirmEnabled,
  setPrimaryBusy,
  setPrimaryEnabled
} from "../ui.js";

import {
  normalizeUpper,
  normalizeAmount
} from "./normalization.js";

import {
  syncCurrencyFromSource
} from "./countries.js";

import {
  clearCanonicalPricing,
  renderCanonicalPricing
} from "./pricing.js";

import {
  renderSelectedDestination
} from "./destination.js";

import {
  preparePaymentReview,
  resolveRouteMethodLabel
} from "./review.js";

import {
  beginReview,
  isCurrentReview
} from "./reviewLifecycle.js";


export async function handleReviewPayment() {
  if (
    !validateEntryForm()
  ) {
    return;
  }

  const generation =
    beginReview();

  const form =
    readEntryForm();

  const sourceCountry =
    normalizeUpper(
      form.sourceCountry
    );

  const receiverCountry =
    normalizeUpper(
      form.receiverCountry
    );

  const amount =
    normalizeAmount(
      form.amount
    );

  const phoneNumber =
    String(
      form.phoneNumber ||
      ""
    ).trim();

  const currency =
    syncCurrencyFromSource();

  /*
  validateEntryForm() should already prevent this,
  but keep the orchestration boundary defensive.
  */

  if (
    !amount ||
    !phoneNumber
  ) {
    return;
  }

  setSourceCountry(
    sourceCountry
  );

  setReceiverCountry(
    receiverCountry
  );

  setAmount(
    amount
  );

  setPhoneNumber(
    phoneNumber
  );

  setCurrency(
    currency
  );

  setError(
    null
  );

  setFlowStatus(
    "preparing_preview"
  );

  setContinueBusy(
    true
  );

  hideConfirmAction();

  setConfirmEnabled(
    false
  );

  hideRouteSummary();

  clearCanonicalPricing();

  clearDestinationFields();

  hideDestinationFields();

  clearStatus();

  setPrimaryBusy(
    false
  );

  setPrimaryEnabled(
    false
  );

  try {
    const review =
      await preparePaymentReview({
        sourceCountry,
        receiverCountry,
        amount,
        phoneNumber,
        currency
      });

    /*
    An entry change may have invalidated this review
    while network requests were running.
    */

    if (
      !isCurrentReview(
        generation
      )
    ) {
      return;
    }

    const {
      sessionId,
      quote,
      routes,
      selectedRoute
    } =
      review;

    setSessionId(
      sessionId
    );

    setSelectedRoute(
      selectedRoute
    );

    setQuote(
      quote
    );

    renderRouteSummary({
      sourceCountry,
      receiverCountry,

      method:
        resolveRouteMethodLabel(
          selectedRoute
        )
    });

    renderCanonicalPricing({
      quote,

      route:
        selectedRoute,

      amount,
      currency,
      sourceCountry,
      receiverCountry
    });

    renderSelectedDestination({
      routes,
      selectedRoute,

      onChange() {
        setConfirmEnabled(
          true
        );
      }
    });

    setFlowStatus(
      "preview_ready"
    );

    showConfirmAction();

    setConfirmEnabled(
      true
    );
  }
  catch (error) {
    if (
      !isCurrentReview(
        generation
      )
    ) {
      return;
    }

    console.error(
      "PAY_BY_BANK_PREVIEW_FAILED",
      error
    );

    clearQuoteState();

    setError(
      error
    );

    setFlowStatus(
      "preview_failed"
    );

    hideRouteSummary();

    clearCanonicalPricing();

    clearDestinationFields();

    hideDestinationFields();

    hideConfirmAction();

    setConfirmEnabled(
      false
    );

    setStatus(
      "Could not prepare this payment route. Please review the details and try again.",
      {
        error:
          true
      }
    );
  }
  finally {
    if (
      isCurrentReview(
        generation
      )
    ) {
      setContinueBusy(
        false
      );
    }
  }
}
