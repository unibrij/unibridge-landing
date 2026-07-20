// shared/pricing/pricing-fees.js

import {
  hasValue,
  isObject,
  normalizeLower,
  normalizeString,
  normalizeUpper,
  resolveAmountValue
} from "./pricing-format.js";

const CUSTOMER_VISIBILITY =
  "customer";

const DECIMAL_PATTERN =
  /^\d+(?:\.\d+)?$/;

function normalizeDecimal(value) {
  const normalized =
    normalizeString(
      resolveAmountValue(value)
    );

  if (
    !DECIMAL_PATTERN.test(normalized)
  ) {
    return null;
  }

  const [
    integerPart,
    fractionPart = ""
  ] = normalized.split(".");

  const integer =
    integerPart.replace(
      /^0+(?=\d)/,
      ""
    ) || "0";

  const fraction =
    fractionPart.replace(
      /0+$/,
      ""
    );

  return fraction
    ? `${integer}.${fraction}`
    : integer;
}

function addDecimals(left, right) {
  const leftParts =
    normalizeDecimal(left)?.split(".");

  const rightParts =
    normalizeDecimal(right)?.split(".");

  if (
    !leftParts ||
    !rightParts
  ) {
    return null;
  }

  const leftFraction =
    leftParts[1] ?? "";

  const rightFraction =
    rightParts[1] ?? "";

  const scale =
    Math.max(
      leftFraction.length,
      rightFraction.length
    );

  const leftUnits =
    BigInt(
      leftParts[0] +
      leftFraction.padEnd(scale, "0")
    );

  const rightUnits =
    BigInt(
      rightParts[0] +
      rightFraction.padEnd(scale, "0")
    );

  const total =
    (leftUnits + rightUnits)
      .toString()
      .padStart(scale + 1, "0");

  if (scale === 0) {
    return total;
  }

  const integer =
    total.slice(0, -scale);

  const fraction =
    total
      .slice(-scale)
      .replace(/0+$/, "");

  return fraction
    ? `${integer}.${fraction}`
    : integer;
}

export function resolveCanonicalFees(
  route
) {
  const candidates = [
    route?.pricing_result?.quote,
    route?.pricing?.quote,
    route
  ];

  for (const candidate of candidates) {
    if (
      isObject(candidate) &&
      Array.isArray(candidate.fees)
    ) {
      return {
        exists: true,
        fees: candidate.fees
      };
    }
  }

  return {
    exists: false,
    fees: []
  };
}

function groupCanonicalFees({
  fees,
  type
}) {
  const normalizedType =
    normalizeLower(type);

  const groups =
    new Map();

  for (const fee of fees) {
    if (!isObject(fee)) {
      continue;
    }

    if (
      normalizeLower(fee.type) !==
      normalizedType
    ) {
      continue;
    }

    if (
      normalizeLower(fee.visibility) !==
      CUSTOMER_VISIBILITY
    ) {
      continue;
    }

    const amount =
      normalizeDecimal(
        fee.amount_decimal ??
        fee.amount
      );

    const currency =
      normalizeUpper(fee.currency);

    if (
      amount === null ||
      !currency
    ) {
      continue;
    }

    const key =
      `${normalizedType}:${currency}`;

    const current =
      groups.get(key);

    const totalAmount =
      current
        ? addDecimals(
            current.amount,
            amount
          )
        : amount;

    if (totalAmount === null) {
      continue;
    }

    groups.set(key, {
      type: normalizedType,
      currency,
      amount: totalAmount
    });
  }

  return [...groups.values()];
}

function resolveFlatFee({
  route,
  type,
  amountField,
  currencyField,
  fallbackCurrency
}) {
  const rawFee =
    route?.[amountField];

  if (!hasValue(rawFee)) {
    return [];
  }

  const amount =
    normalizeDecimal(rawFee);

  const currency =
    normalizeUpper(
      isObject(rawFee)
        ? (
            rawFee.currency ??
            route?.[currencyField] ??
            fallbackCurrency
          )
        : (
            route?.[currencyField] ??
            fallbackCurrency
          )
    );

  if (
    amount === null ||
    !currency
  ) {
    return [];
  }

  return [{
    type: normalizeLower(type),
    amount,
    currency
  }];
}

export function resolveFeeGroups({
  route,
  canonicalFees = {
    exists: false,
    fees: []
  },
  type,
  amountField,
  currencyField,
  fallbackCurrency = null
}) {
  if (canonicalFees.exists) {
    return groupCanonicalFees({
      fees:
        Array.isArray(canonicalFees.fees)
          ? canonicalFees.fees
          : [],

      type
    });
  }

  return resolveFlatFee({
    route,
    type,
    amountField,
    currencyField,
    fallbackCurrency
  });
}
