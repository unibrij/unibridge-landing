// fiat/bank-transfer/js/state.js

const STORAGE_KEY =
  "unibridge_bank_transfer_flow";

function normalizeString(value) {
  return String(value || "").trim();
}

export function readQueryParams() {
  const params =
    new URLSearchParams(window.location.search);

  return {
    settlement_id:
      normalizeString(
        params.get("settlement_id")
      ),

    email:
      normalizeString(
        params.get("email")
      ),

    phone:
      normalizeString(
        params.get("phone")
      ),

    source_country:
      normalizeString(
        params.get("source_country")
      ),

    source_rail:
      normalizeString(
        params.get("source_rail")
      )
  };
}

export function readStoredState() {
  try {
    const raw =
      window.localStorage.getItem(
        STORAGE_KEY
      );

    if (!raw) {
      return {};
    }

    const parsed =
      JSON.parse(raw);

    return parsed && typeof parsed === "object"
      ? parsed
      : {};
  } catch {
    return {};
  }
}

export function writeStoredState(nextState = {}) {
  const current =
    readStoredState();

  const merged = {
    ...current,
    ...nextState,
    updated_at:
      new Date().toISOString()
  };

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(merged)
  );

  return merged;
}

export function clearStoredState() {
  window.localStorage.removeItem(
    STORAGE_KEY
  );
}

export function resolveInitialState(defaults = {}) {
  const stored =
    readStoredState();

  const query =
    readQueryParams();

  return {
    ...defaults,
    ...stored,
    ...Object.fromEntries(
      Object.entries(query).filter(([, value]) => {
        return Boolean(value);
      })
    )
  };
}
