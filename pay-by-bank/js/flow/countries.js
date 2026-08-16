// pay-by-bank/js/flow/countries.js

import {
  getState,
  setCurrency
} from "../state.js";

import {
  setCurrency as setUiCurrency
} from "../ui.js";

import {
  normalizeString,
  normalizeUpper
} from "./normalization.js";


export function getCountryOptions() {
  const options =
    window
      .UNIBRIDGE_COUNTRY_OPTIONS ||
    {};

  return {
    source:
      Array.isArray(
        options.source
      )
        ? options.source
        : [],

    destination:
      Array.isArray(
        options.destination
      )
        ? options.destination
        : []
  };
}


export function getSourceCurrency() {
  if (
    typeof window
      .getUniBridgeSourceCurrency ===
      "function"
  ) {
    return (
      normalizeUpper(
        window
          .getUniBridgeSourceCurrency()
      ) ||
      "USD"
    );
  }

  const state =
    getState();

  return (
    normalizeUpper(
      state.currency
    ) ||
    "USD"
  );
}


export function syncCurrencyFromSource() {
  const currency =
    getSourceCurrency();

  setCurrency(
    currency
  );

  setUiCurrency(
    currency
  );

  if (
    typeof window
      .syncUniBridgeAmountCurrency ===
      "function"
  ) {
    window
      .syncUniBridgeAmountCurrency();
  }

  return currency;
}


export function syncSharedCountryUi() {
  if (
    typeof window
      .populateUniBridgeCountrySelects ===
      "function"
  ) {
    window
      .populateUniBridgeCountrySelects();
  }

  return syncCurrencyFromSource();
}


export function findCountryLabel(
  type,
  code
) {
  const options =
    getCountryOptions();

  const normalizedCode =
    normalizeUpper(
      code
    );

  const collection =
    type ===
      "destination"
      ? options.destination
      : options.source;

  const match =
    collection.find(
      item =>
        normalizeUpper(
          item?.value ||
          item?.code
        ) ===
        normalizedCode
    );

  return (
    normalizeString(
      match?.label
    ) ||
    normalizedCode
  );
}
