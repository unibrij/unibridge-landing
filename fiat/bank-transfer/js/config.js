// fiat/bank-transfer/js/config.js

export const BACKEND_BASE =
  "https://unibridge-v2-1066944028362.us-central1.run.app";

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

export function getBackendUrl(path) {
  const normalizedBase =
    String(BACKEND_BASE).replace(/\/+$/, "");

  const normalizedPath =
    String(path || "").startsWith("/")
      ? path
      : `/${path}`;

  return `${normalizedBase}${normalizedPath}`;
}

export function getDefaultSourceRail() {
  return {
    source_country:
      DEFAULT_SOURCE_COUNTRY,
    source_rail:
      DEFAULT_SOURCE_RAIL
  };
}
