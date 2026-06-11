// unibrij/unibridge-landing/surface/core/flowStorage.js

/*
--------------------------------------------------
Surface Flow Storage

Purpose:
- keep settlement persistence outside app.js
- store only short-lived settlement resume state
- avoid long-lived stale resume after abandoned ramp
- keep localStorage logic isolated

Stored shape:
{
  id: "settlement_id",
  ts: 1710000000000,
  payment_started: true | false
}
--------------------------------------------------
*/

const DEFAULT_STORAGE_KEY =
  "ub_settlement";

const DEFAULT_TTL_MS =
  30 * 60 * 1000;

function nowMs() {
  return Date.now();
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function hasLocalStorage() {
  try {
    return Boolean(
      window.localStorage
    );
  } catch {
    return false;
  }
}

function normalizeStorageKey(key) {
  return String(
    key ||
      DEFAULT_STORAGE_KEY
  ).trim() || DEFAULT_STORAGE_KEY;
}

function normalizeTtlMs(value) {
  const ttl =
    Number(value);

  return Number.isFinite(ttl) && ttl > 0
    ? ttl
    : DEFAULT_TTL_MS;
}

export function persistFlowState({
  id,
  paymentStarted = false,
  storageKey = DEFAULT_STORAGE_KEY
} = {}) {
  if (!id || !hasLocalStorage()) {
    return false;
  }

  const key =
    normalizeStorageKey(storageKey);

  const payload = {
    id,
    ts:
      nowMs(),

    payment_started:
      Boolean(paymentStarted)
  };

  try {
    window.localStorage.setItem(
      key,
      JSON.stringify(payload)
    );

    return true;
  } catch {
    return false;
  }
}

export function readFlowState({
  storageKey = DEFAULT_STORAGE_KEY,
  ttlMs = DEFAULT_TTL_MS
} = {}) {
  if (!hasLocalStorage()) {
    return null;
  }

  const key =
    normalizeStorageKey(storageKey);

  const ttl =
    normalizeTtlMs(ttlMs);

  try {
    const raw =
      window.localStorage.getItem(key);

    if (!raw) {
      return null;
    }

    const data =
      safeJsonParse(raw);

    if (!data?.id) {
      window.localStorage.removeItem(key);
      return null;
    }

    const ts =
      Number(data.ts);

    if (
      !Number.isFinite(ts) ||
      nowMs() - ts > ttl
    ) {
      window.localStorage.removeItem(key);
      return null;
    }

    return {
      id:
        data.id,

      payment_started:
        Boolean(data.payment_started)
    };
  } catch {
    return null;
  }
}

export function clearFlowState({
  storageKey = DEFAULT_STORAGE_KEY
} = {}) {
  if (!hasLocalStorage()) {
    return false;
  }

  const key =
    normalizeStorageKey(storageKey);

  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function markFlowPaymentStarted({
  id,
  storageKey = DEFAULT_STORAGE_KEY
} = {}) {
  return persistFlowState({
    id,
    paymentStarted:
      true,

    storageKey
  });
}

export {
  DEFAULT_STORAGE_KEY,
  DEFAULT_TTL_MS
};
