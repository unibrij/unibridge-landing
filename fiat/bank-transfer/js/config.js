// fiat/bank-transfer/js/config.js

export const DEFAULT_SOURCE_COUNTRY =
  "US";

export const DEFAULT_SOURCE_RAIL =
  "ach_push";

export const SUPPORTED_SOURCE_RAILS = [
  {
    country: "US",
    rail: "ach_push",
    label: "USD bank transfer",
    description: "ACH Push from a US bank account"
  },
  {
    country: "EU",
    rail: "sepa",
    label: "EUR bank transfer",
    description: "SEPA transfer from a supported European bank account"
  },
  {
    country: "GB",
    rail: "faster_payments",
    label: "GBP bank transfer",
    description: "Faster Payments from a UK bank account"
  }
];

export function getDefaultSourceRail() {
  return {
    source_country:
      DEFAULT_SOURCE_COUNTRY,

    source_rail:
      DEFAULT_SOURCE_RAIL
  };
}

export function resolveSourceRail(sourceCountry) {
  const country =
    String(sourceCountry || "")
      .trim()
      .toUpperCase();

  const matched =
    SUPPORTED_SOURCE_RAILS.find((item) => {
      return item.country === country;
    });

  if (matched) {
    return {
      source_country:
        matched.country,

      source_rail:
        matched.rail
    };
  }

  return getDefaultSourceRail();
}
