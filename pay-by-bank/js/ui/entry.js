// pay-by-bank/js/ui/entry.js

import {
  getRequiredElements
} from "./elements.js";

import {
  clearFieldError,
  showFieldError,
  setHidden
} from "./dom.js";


export function setCurrency(
  currency
) {
  const {
    amountCurrency
  } =
    getRequiredElements();

  const normalized =
    String(
      currency || "EUR"
    )
      .trim()
      .toUpperCase();

  amountCurrency.textContent =
    normalized ||
    "EUR";
}


export function readEntryForm() {
  const {
    sourceCountry,
    receiverCountry,
    amount
  } =
    getRequiredElements();

  return {
    sourceCountry:
      String(
        sourceCountry.value ||
        ""
      )
        .trim()
        .toUpperCase(),

    receiverCountry:
      String(
        receiverCountry.value ||
        ""
      )
        .trim()
        .toUpperCase(),

    amount:
      amount.value
  };
}


export function validateEntryForm() {
  const {
    sourceCountry,
    receiverCountry,
    amount
  } =
    getRequiredElements();

  clearFieldError(
    sourceCountry
  );

  clearFieldError(
    receiverCountry
  );

  clearFieldError(
    amount
  );

  let valid =
    true;

  const source =
    String(
      sourceCountry.value ||
      ""
    ).trim();

  if (!source) {
    showFieldError(
      sourceCountry,
      "Choose where you are paying from."
    );

    valid =
      false;
  }

  const receiver =
    String(
      receiverCountry.value ||
      ""
    ).trim();

  if (!receiver) {
    showFieldError(
      receiverCountry,
      "Choose where you are sending to."
    );

    valid =
      false;
  }

  const parsedAmount =
    Number(
      amount.value
    );

  if (
    !Number.isFinite(
      parsedAmount
    ) ||
    parsedAmount <= 0
  ) {
    showFieldError(
      amount,
      "Enter a valid amount."
    );

    valid =
      false;
  }

  return valid;
}


export function showEntry() {
  const {
    entryBox,
    prepareBox
  } =
    getRequiredElements();

  setHidden(
    entryBox,
    false
  );

  setHidden(
    prepareBox,
    true
  );
}


export function showPreparation() {
  const {
    entryBox,
    prepareBox
  } =
    getRequiredElements();

  setHidden(
    entryBox,
    true
  );

  setHidden(
    prepareBox,
    false
  );
}
