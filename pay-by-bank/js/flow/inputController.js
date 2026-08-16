// pay-by-bank/js/flow/inputController.js

import {
  setSourceCountry,
  setReceiverCountry,
  setAmount
} from "../state.js";

import {
  readEntryForm,
  setConfirmEnabled
} from "../ui.js";

import {
  syncCurrencyFromSource
} from "./countries.js";

import {
  invalidateReview,
  invalidateSettlementForDestinationChange
} from "./reviewLifecycle.js";


export function handleEntryChange() {
  const form =
    readEntryForm();

  setSourceCountry(
    form.sourceCountry
  );

  setReceiverCountry(
    form.receiverCountry
  );

  setAmount(
    form.amount
  );

  syncCurrencyFromSource();

  invalidateReview();
}


export function handleDestinationChange() {
  invalidateSettlementForDestinationChange();

  setConfirmEnabled(
    true
  );
}
