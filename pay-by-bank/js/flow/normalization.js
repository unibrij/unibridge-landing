// pay-by-bank/js/flow/normalization.js

export function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}


export function normalizeUpper(
  value
) {
  return normalizeString(
    value
  ).toUpperCase();
}


export function normalizeAmount(
  value
) {
  const parsed =
    Number(
      value
    );

  if (
    !Number.isFinite(
      parsed
    ) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}
