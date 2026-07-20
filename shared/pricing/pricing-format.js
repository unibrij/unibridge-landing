// shared/pricing/pricing-format.js

export function isObject(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

export function normalizeString(value) {
  return String(value ?? "").trim();
}

export function normalizeLower(value) {
  return normalizeString(value).toLowerCase();
}

export function normalizeUpper(value) {
  return normalizeString(value).toUpperCase();
}

export function hasValue(value) {
  return (
    value !== undefined &&
    value !== null &&
    normalizeString(value) !== ""
  );
}

export function resolveAmountValue(value) {
  if (!isObject(value)) {
    return value;
  }

  return (
    value.amount_decimal ??
    value.amount ??
    value.value ??
    null
  );
}

export function toFiniteNumber(value) {
  const resolvedValue =
    resolveAmountValue(value);

  if (!hasValue(resolvedValue)) {
    return null;
  }

  const number =
    Number(resolvedValue);

  return Number.isFinite(number)
    ? number
    : null;
}

export function formatNumber(
  value,
  maximumFractionDigits = 2
) {
  const number =
    toFiniteNumber(value);

  if (number === null) {
    return "";
  }

  return number.toLocaleString("en-US", {
    maximumFractionDigits
  });
}

export function formatAmount(
  amount,
  currency,
  approximate = false
) {
  const formattedAmount =
    formatNumber(amount);

  if (!formattedAmount) {
    return "";
  }

  return [
    approximate ? "≈" : "",
    formattedAmount,
    normalizeUpper(currency)
  ]
    .filter(Boolean)
    .join(" ");
}

export function formatFxRate({
  fxRate,
  settlementCurrency,
  recipientCurrency
}) {
  const objectRate =
    isObject(fxRate)
      ? fxRate
      : null;

  const value =
    objectRate
      ? (
          objectRate.value ??
          objectRate.rate
        )
      : fxRate;

  const formattedRate =
    formatNumber(value, 6);

  if (!formattedRate) {
    return "";
  }

  const baseCurrency =
    normalizeUpper(
      objectRate?.base_currency ??
      objectRate?.baseCurrency ??
      settlementCurrency
    );

  const quoteCurrency =
    normalizeUpper(
      objectRate?.quote_currency ??
      objectRate?.quoteCurrency ??
      recipientCurrency
    );

  if (
    !baseCurrency ||
    !quoteCurrency
  ) {
    return formattedRate;
  }

  return (
    `1 ${baseCurrency} ≈ ` +
    `${formattedRate} ${quoteCurrency}`
  );
}
