// fiat/bank-transfer/js/funding/bankInstructionFormatters.js

export function normalizeString(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
}

export function hasValue(value) {
  return normalizeString(value).length > 0;
}

export function formatLabel(value) {
  return normalizeString(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

export function formatPaymentRail(value) {
  const normalized =
    normalizeString(value).toLowerCase();

  if (normalized === "ach_push") {
    return "ACH Push";
  }

  if (normalized === "ach") {
    return "ACH";
  }

  if (normalized === "sepa") {
    return "SEPA";
  }

  if (normalized === "faster_payments") {
    return "Faster Payments";
  }

  return formatLabel(value);
}

export function formatDisplayValue(row = {}) {
  const value =
    normalizeString(row.value);

  if (row.formatter === "uppercase") {
    return value.toUpperCase();
  }

  if (row.formatter === "rail") {
    return formatPaymentRail(value);
  }

  if (row.formatter === "label") {
    return formatLabel(value);
  }

  return value;
}

export function escapeHtml(value) {
  return normalizeString(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function escapeAttribute(value) {
  return escapeHtml(value);
}

export function encodeCopyValue(value) {
  return encodeURIComponent(
    normalizeString(value)
  );
}

export function decodeCopyValue(value) {
  try {
    return decodeURIComponent(
      normalizeString(value)
    );
  } catch {
    return normalizeString(value);
  }
}
