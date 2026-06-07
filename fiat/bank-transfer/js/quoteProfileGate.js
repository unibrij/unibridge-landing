// fiat/bank-transfer/js/quoteProfileGate.js

import {
  prepareCustomerProfileForm,
  focusCustomerProfileField,
  hideCustomerProfileForm
} from "./customerProfile.js";

import {
  showEntryMode
} from "./flowUi.js";

export function hasPreparedQuote(preparedQuote) {
  return Boolean(
    preparedQuote?.session_id &&
    preparedQuote?.quote &&
    preparedQuote?.selected_route
  );
}

export function showCustomerProfileAfterQuote({
  preparedQuote
} = {}) {
  if (!hasPreparedQuote(preparedQuote)) {
    hideCustomerProfileForm();

    return false;
  }

  prepareCustomerProfileForm();

  return true;
}

export function handleCustomerProfileError({
  err,
  preparedQuote,
  resolveErrorMessage,
  setStatus
} = {}) {
  if (!err?.field) {
    return false;
  }

  if (!hasPreparedQuote(preparedQuote)) {
    hideCustomerProfileForm();

    return false;
  }

  showEntryMode();

  showCustomerProfileAfterQuote({
    preparedQuote
  });

  focusCustomerProfileField(
    err.field
  );

  setStatus({
    kind:
      "failed",

    message:
      resolveErrorMessage(err)
  });

  return true;
}
