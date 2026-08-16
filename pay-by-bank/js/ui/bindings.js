// pay-by-bank/js/ui/bindings.js

import {
  getRequiredElements
} from "./elements.js";


export function bindContinue(
  handler
) {
  const {
    continueAction
  } =
    getRequiredElements();

  continueAction.addEventListener(
    "click",
    handler
  );
}


export function bindConfirm(
  handler
) {
  const {
    confirmAction
  } =
    getRequiredElements();

  confirmAction.addEventListener(
    "click",
    handler
  );
}


export function bindPrimary(
  handler
) {
  const {
    primaryAction
  } =
    getRequiredElements();

  primaryAction.addEventListener(
    "click",
    handler
  );
}


export function bindBack(
  handler
) {
  const {
    backAction
  } =
    getRequiredElements();

  backAction.addEventListener(
    "click",
    handler
  );
}


export function bindEntryChange(
  handler
) {
  const {
    sourceCountry,
    receiverCountry,
    amount
  } =
    getRequiredElements();

  sourceCountry.addEventListener(
    "change",
    handler
  );

  receiverCountry.addEventListener(
    "change",
    handler
  );

  amount.addEventListener(
    "input",
    handler
  );
}


export function bindDestinationChange(
  handler
) {
  const {
    destinationFields
  } =
    getRequiredElements();

  destinationFields.addEventListener(
    "input",
    handler
  );

  destinationFields.addEventListener(
    "change",
    handler
  );
}
