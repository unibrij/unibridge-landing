// unibrij/unibridge-landing/surface/storage.js

export const SURFACE_STORAGE_KEY = "ub_settlement";

const DEFAULT_TTL_MS =
  30 * 60 * 1000;

function readJson(storageKey) {
  try {
    const raw =
      localStorage.getItem(storageKey);

    if (!raw) {
      return null;
    }

    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function persistSurfaceSettlement({
  id,
  paymentStarted = false,
  storageKey = SURFACE_STORAGE_KEY
} = {}) {
  if (!id) {
    return;
  }

  localStorage.setItem(
    storageKey,
    JSON.stringify({
      id,
      ts: Date.now(),
      payment_started: Boolean(paymentStarted)
    })
  );
}

export function getPersistedSurfaceSettlement({
  storageKey = SURFACE_STORAGE_KEY,
  ttlMs = DEFAULT_TTL_MS
} = {}) {
  const data =
    readJson(storageKey);

  if (!data?.id) {
    return null;
  }

  if (Date.now() - Number(data.ts || 0) > ttlMs) {
    localStorage.removeItem(storageKey);
    return null;
  }

  return {
    id: data.id,
    payment_started: Boolean(data.payment_started)
  };
}

export function clearPersistedSurfaceSettlement({
  storageKey = SURFACE_STORAGE_KEY
} = {}) {
  localStorage.removeItem(storageKey);
}
