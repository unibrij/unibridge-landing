// pay-by-bank/js/ui/entry.js

import {
  getRequiredElements
} from "./elements.js";

import {
  clearFieldError,
  showFieldError,
  setHidden
} from "./dom.js";


function normalizePhoneNumber(
  value
) {
  return String(
    value ||
    ""
  )
    .trim();
}


function isValidOnrampPhoneNumber(
  value
) {
  return /^\+\d{1,4}-\d+$/.test(
    normalizePhoneNumber(
      value
    )
  );
}


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
    amount,
    phoneNumber
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
      amount.value,

    phoneNumber:
      normalizePhoneNumber(
        phoneNumber.value
      )
  };
}


export function validateEntryForm() {
  const {
    sourceCountry,
    receiverCountry,
    amount,
    phoneNumber
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

  clearFieldError(
    phoneNumber
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

  const phone =
    normalizePhoneNumber(
      phoneNumber.value
    );

  if (!phone) {
    showFieldError(
      phoneNumber,
      "Enter your phone number."
    );

    valid =
      false;
  }
  else if (
    !isValidOnrampPhoneNumber(
      phone
    )
  ) {
    showFieldError(
      phoneNumber,
      "Use format +countryCode-phoneNumber."
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
