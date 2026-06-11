// unibrij/unibridge-landing/surface/core/fieldLocks.js

/*
--------------------------------------------------
Surface Field Locks

Purpose:
- keep input lock/unlock logic outside app.js
- disable quote inputs after flow starts
- re-enable inputs after reset
- avoid payment/session/route logic here

Notes:
- This module does not start flows.
- This module does not create settlements.
- This module does not create funding sessions.
- This module does not touch Brazil / SmartPay.
--------------------------------------------------
*/

function getElement(id) {
  if (!id) {
    return null;
  }

  return document.getElementById(id);
}

function resolveElement(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return getElement(value);
  }

  return value;
}

function setDisabled(target, disabled) {
  const el =
    resolveElement(target);

  if (!el) {
    return false;
  }

  el.disabled =
    Boolean(disabled);

  return true;
}

export function setFieldsDisabled(fields = [], disabled) {
  fields
    .map(resolveElement)
    .filter(Boolean)
    .forEach((field) => {
      field.disabled =
        Boolean(disabled);
    });

  return true;
}

export function setQuoteFieldsDisabled({
  disabled,
  amountInput,
  sourceCountryInput,
  destinationCountryInput
} = {}) {
  return setFieldsDisabled(
    [
      amountInput,
      sourceCountryInput,
      destinationCountryInput
    ],
    disabled
  );
}

export function setBrazilDestinationFieldsDisabled({
  disabled,
  pixInput,
  taxIdInput
} = {}) {
  return setFieldsDisabled(
    [
      pixInput,
      taxIdInput
    ],
    disabled
  );
}

export function setButtonDisabled({
  button,
  disabled
} = {}) {
  return setDisabled(
    button,
    disabled
  );
}

export function lockSurfaceEntryFields({
  amountInput,
  sourceCountryInput,
  destinationCountryInput,
  pixInput,
  taxIdInput
} = {}) {
  setQuoteFieldsDisabled({
    disabled:
      true,

    amountInput,
    sourceCountryInput,
    destinationCountryInput
  });

  setBrazilDestinationFieldsDisabled({
    disabled:
      true,

    pixInput,
    taxIdInput
  });

  return true;
}

export function unlockSurfaceEntryFields({
  amountInput,
  sourceCountryInput,
  destinationCountryInput,
  pixInput,
  taxIdInput
} = {}) {
  setQuoteFieldsDisabled({
    disabled:
      false,

    amountInput,
    sourceCountryInput,
    destinationCountryInput
  });

  setBrazilDestinationFieldsDisabled({
    disabled:
      false,

    pixInput,
    taxIdInput
  });

  return true;
}
