// unibridge-landing-main/fiat/bank-transfer/js/eligibility.js

const SEPA_COUNTRIES = Object.freeze({
  AT: "Austria",
  BE: "Belgium",
  BG: "Bulgaria",
  HR: "Croatia",
  CY: "Cyprus",
  CZ: "Czechia",
  DK: "Denmark",
  EE: "Estonia",
  FI: "Finland",
  FR: "France",
  DE: "Germany",
  GR: "Greece",
  HU: "Hungary",
  IE: "Ireland",
  IT: "Italy",
  LV: "Latvia",
  LT: "Lithuania",
  LU: "Luxembourg",
  MT: "Malta",
  NL: "Netherlands",
  PL: "Poland",
  PT: "Portugal",
  RO: "Romania",
  SK: "Slovakia",
  SI: "Slovenia",
  ES: "Spain",
  SE: "Sweden",
  GB: "United Kingdom",
  CH: "Switzerland",
  NO: "Norway",
  IS: "Iceland",
  LI: "Liechtenstein"
});

const FPS_COUNTRIES = Object.freeze({
  GB: "United Kingdom"
});

const str = value =>
  String(value ?? "").trim();

const lower = value =>
  str(value).toLowerCase();

const upper = value =>
  str(value).toUpperCase();

const isObject = value =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value);

export function resolveInstructions(funding) {
  return [
    funding?.source_deposit_instructions,
    funding?.next_action?.instructions,
    funding?.deposit_instructions,
    funding?.bank_instructions,
    funding?.instructions
  ].find(isObject) || null;
}

export function resolveEligibility(funding) {
  const provider = lower(
    funding?.provider ||
    funding?.next_action?.provider
  );

  if (
    provider !== "bridge" ||
    (
      funding?.sender_id &&
      lower(funding.sender_id) !==
        "bridge_bank_transfer"
    ) ||
    !str(funding?.bridge_transfer_id)
  ) {
    return null;
  }

  const instructions =
    resolveInstructions(funding);

  if (!instructions) {
    return null;
  }

  const rail = lower(
    funding.source_rail ||
    funding.next_action?.source_rail ||
    instructions.source_rail ||
    instructions.payment_rail
  );

  const currency = upper(
    funding.source_currency ||
    funding.next_action?.source_currency ||
    instructions.currency ||
    instructions.source_currency
  );

  if (
    rail === "sepa" &&
    currency === "EUR" &&
    str(instructions.iban)
  ) {
    return { rail };
  }

  if (
    rail === "faster_payments" &&
    currency === "GBP" &&
    str(
      instructions.bank_account_number ||
      instructions.account_number ||
      instructions.bacs?.account
    ) &&
    str(
      instructions.sort_code ||
      instructions.bacs?.sort_code
    )
  ) {
    return { rail };
  }

  return null;
}

export function getEligibleBankCountries(rail) {
  if (rail === "faster_payments") {
    return FPS_COUNTRIES;
  }

  if (rail === "sepa") {
    return SEPA_COUNTRIES;
  }

  return Object.freeze({});
}
