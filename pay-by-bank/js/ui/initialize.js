// pay-by-bank/js/ui/initialize.js

import {
  getRequiredElements
} from "./elements.js";

import {
  populateSourceCountries,
  populateReceiverCountries,
  setCurrency,
  showEntry
} from "./entry.js";

import {
  hideRouteSummary
} from "./routeSummary.js";

import {
  clearPricingPreviewMount,
  clearDestinationFields,
  hideDestinationFields
} from "./mounts.js";

import {
  clearStatus
} from "./status.js";

import {
  resetSteps
} from "./steps.js";

import {
  hideConfirmAction,
  setContinueBusy,
  setConfirmBusy,
  setPrimaryBusy,
  setPrimaryEnabled,
  setConfirmEnabled,
  setBackEnabled
} from "./actions.js";


export function initializeUI({
  sourceCountries = [],
  receiverCountries = [],
  currency = "EUR"
} = {}) {
  const ui =
    getRequiredElements();

  populateSourceCountries(
    sourceCountries
  );

  populateReceiverCountries(
    receiverCountries
  );

  setCurrency(
    currency
  );

  showEntry();

  clearStatus();

  hideRouteSummary();

  clearPricingPreviewMount();

  clearDestinationFields();

  hideDestinationFields();

  hideConfirmAction();

  setContinueBusy(
    false
  );

  setConfirmBusy(
    false
  );

  setConfirmEnabled(
    false
  );

  setPrimaryBusy(
    false
  );

  setPrimaryEnabled(
    false
  );

  setBackEnabled(
    true
  );

  resetSteps();

  return ui;
}
