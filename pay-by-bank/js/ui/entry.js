// pay-by-bank/js/ui/entry.js

import {
  getRequiredElements
} from "./elements.js";

import {
  clearFieldError,
  showFieldError,
  setHidden
} from "./dom.js";


function normalizeCountryOptions(
  countries = []
) {
  if (
    !Array.isArray(
      countries
    )
  ) {
    return [];
  }

  return countries
    .map(country => {
      if (
        typeof country ===
        "string"
      ) {
        const code =
          country
            .trim()
            .toUpperCase();

        return code
          ? {
              code,
              label:
                code
            }
          : null;
      }

      if (
        !country ||
        typeof country !==
          "object"
      ) {
        return null;
      }

      const code =
        String(
          country.code ||
          country.value ||
          ""
        )
          .trim()
          .toUpperCase();

      if (!code) {
        return null;
      }

      const label =
        String(
          country.label ||
          country.name ||
          code
        ).trim();

      return {
        code,

        label:
          label ||
          code
      };
    })
    .filter(Boolean);
}


function populateCountrySelect(
  select,
  countries = [],
  {
    placeholder =
      "Select country"
  } = {}
) {
  const options =
    normalizeCountryOptions(
      countries
    );

  select.replaceChildren();

  const placeholderOption =
    document.createElement(
      "option"
    );

  placeholderOption.value =
    "";

  placeholderOption.textContent =
    placeholder;

  placeholderOption.disabled =
    true;

  placeholderOption.selected =
    true;

  select.appendChild(
    placeholderOption
  );

  for (
    const country of
    options
  ) {
    const option =
      document.createElement(
        "option"
      );

    option.value =
      country.code;

    option.textContent =
      country.label;

    select.appendChild(
      option
    );
  }
}


export function populateSourceCountries(
  countries = []
) {
  const {
    sourceCountry
  } =
    getRequiredElements();

  populateCountrySelect(
    sourceCountry,
    countries,
    {
      placeholder:
        "Select country"
    }
  );
}


export function populateReceiverCountries(
  countries = []
) {
  const {
    receiverCountry
  } =
    getRequiredElements();

  populateCountrySelect(
    receiverCountry,
    countries,
    {
      placeholder:
        "Select destination"
    }
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
