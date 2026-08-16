// pay-by-bank/js/flow/bootstrap.js

import {
  setState
} from "../state.js";

import {
  initializeUI,
  readEntryForm,
  bindContinue,
  bindConfirm,
  bindPrimary,
  bindBack,
  bindEntryChange,
  bindDestinationChange,
  setPrimaryEnabled,
  setConfirmEnabled
} from "../ui.js";

import {
  normalizeUpper,
  normalizeAmount
} from "./normalization.js";

import {
  getSourceCurrency,
  syncSharedCountryUi
} from "./countries.js";

import {
  handleReviewPayment
} from "./reviewController.js";

import {
  handleConfirmPayment,
  handleOpenBank,
  handleBack
} from "./paymentController.js";

import {
  handleEntryChange,
  handleDestinationChange
} from "./inputController.js";


export function initializePayByBankFlow() {
  initializeUI({
    currency:
      "EUR"
  });

  /*
  Shared Pay owns country population and country
  selection behavior.

  Pay-by-Bank only asks the shared layer to sync
  the existing source/destination selects.
  */

  syncSharedCountryUi();

  const initialForm =
    readEntryForm();

  setState({
    sourceCountry:
      normalizeUpper(
        initialForm.sourceCountry
      ) ||
      null,

    receiverCountry:
      normalizeUpper(
        initialForm.receiverCountry
      ) ||
      null,

    amount:
      normalizeAmount(
        initialForm.amount
      ),

    currency:
      getSourceCurrency(),

    status:
      "idle",

    error:
      null
  });

  bindContinue(
    handleReviewPayment
  );

  bindConfirm(
    handleConfirmPayment
  );

  bindPrimary(
    handleOpenBank
  );

  bindBack(
    handleBack
  );

  bindEntryChange(
    handleEntryChange
  );

  bindDestinationChange(
    handleDestinationChange
  );

  setPrimaryEnabled(
    false
  );

  setConfirmEnabled(
    false
  );
}
