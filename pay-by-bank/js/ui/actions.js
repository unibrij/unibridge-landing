// pay-by-bank/js/ui/actions.js

import {
  getRequiredElements
} from "./elements.js";

import {
  setButtonBusy,
  setHidden
} from "./dom.js";


export function showConfirmAction() {
  const {
    confirmAction
  } =
    getRequiredElements();

  setHidden(
    confirmAction,
    false
  );
}


export function hideConfirmAction() {
  const {
    confirmAction
  } =
    getRequiredElements();

  setHidden(
    confirmAction,
    true
  );
}


export function setContinueBusy(
  busy
) {
  const {
    continueAction
  } =
    getRequiredElements();

  setButtonBusy(
    continueAction,
    busy,
    "Preparing preview…",
    "Review payment"
  );
}


export function setConfirmBusy(
  busy
) {
  const {
    confirmAction
  } =
    getRequiredElements();

  setButtonBusy(
    confirmAction,
    busy,
    "Preparing payment…",
    "Continue with bank"
  );
}


export function setConfirmEnabled(
  enabled
) {
  const {
    confirmAction
  } =
    getRequiredElements();

  confirmAction.disabled =
    !enabled;
}


export function setPrimaryBusy(
  busy
) {
  const {
    primaryAction
  } =
    getRequiredElements();

  setButtonBusy(
    primaryAction,
    busy,
    "Opening bank…",
    "Continue to bank"
  );
}


export function setPrimaryEnabled(
  enabled
) {
  const {
    primaryAction
  } =
    getRequiredElements();

  primaryAction.disabled =
    !enabled;
}


export function setBackEnabled(
  enabled
) {
  const {
    backAction
  } =
    getRequiredElements();

  backAction.disabled =
    !enabled;
}
