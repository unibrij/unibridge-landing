// fiat/bank-transfer/js/funding/normalize.js

export function normalizeString(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
}

export function normalizeLower(value) {
  return normalizeString(
    value
  ).toLowerCase();
}

export function readNested(
  value,
  path = []
) {
  let current =
    value;

  for (const key of path) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object"
    ) {
      return null;
    }

    current =
      current[key];
  }

  return current;
}

export function normalizeArray(value) {
  if (
    Array.isArray(value)
  ) {
    return value;
  }

  return [];
}

export function stringifySafe(value) {
  try {
    return JSON.stringify(
      value === undefined
        ? null
        : value
    );
  } catch {
    return null;
  }
}
