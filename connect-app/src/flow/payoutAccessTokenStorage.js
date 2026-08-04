// connect-app/src/flow/payoutAccessTokenStorage.js

const STORAGE_KEY_PREFIX =
  "unibridge_payout_access_token:";

const PAYOUT_ACCESS_TOKEN_PATTERN =
  /^ub_pat_[A-Za-z0-9_-]{43}$/;

function normalizeString(value) {
  return String(
    value || ""
  ).trim();
}

function getLocalStorage() {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  try {
    return (
      window.localStorage ||
      null
    );
  }
  catch {
    return null;
  }
}

function buildStorageKey(
  payoutIntentId
) {
  const intentId =
    normalizeString(
      payoutIntentId
    );

  if (!intentId) {
    return null;
  }

  return (
    STORAGE_KEY_PREFIX +
    intentId
  );
}

function normalizeExpiry(
  expiresAt
) {
  const value =
    normalizeString(
      expiresAt
    );

  if (!value) {
    return null;
  }

  const timestamp =
    Date.parse(
      value
    );

  if (
    !Number.isFinite(
      timestamp
    )
  ) {
    return null;
  }

  return {
    value,
    timestamp
  };
}

function safelyRemoveItem(
  storage,
  key
) {
  if (
    !storage ||
    !key
  ) {
    return;
  }

  try {
    storage.removeItem(
      key
    );
  }
  catch {
    // Storage may be unavailable or blocked.
  }
}

export function readPayoutAccessToken(
  payoutIntentId
) {
  const key =
    buildStorageKey(
      payoutIntentId
    );

  const storage =
    getLocalStorage();

  if (
    !key ||
    !storage
  ) {
    return null;
  }

  try {
    const raw =
      storage.getItem(
        key
      );

    if (!raw) {
      return null;
    }

    const stored =
      JSON.parse(
        raw
      );

    const token =
      normalizeString(
        stored?.token
      );

    const expiry =
      normalizeExpiry(
        stored?.expires_at
      );

    if (
      !PAYOUT_ACCESS_TOKEN_PATTERN.test(
        token
      ) ||
      !expiry ||
      expiry.timestamp <=
        Date.now()
    ) {
      safelyRemoveItem(
        storage,
        key
      );

      return null;
    }

    return {
      token,

      expires_at:
        expiry.value
    };
  }
  catch {
    safelyRemoveItem(
      storage,
      key
    );

    return null;
  }
}

export function storePayoutAccessToken({
  payoutIntentId,
  token,
  expiresAt
}) {
  const key =
    buildStorageKey(
      payoutIntentId
    );

  const storage =
    getLocalStorage();

  const normalizedToken =
    normalizeString(
      token
    );

  const expiry =
    normalizeExpiry(
      expiresAt
    );

  if (
    !key ||
    !PAYOUT_ACCESS_TOKEN_PATTERN.test(
      normalizedToken
    ) ||
    !expiry ||
    expiry.timestamp <=
      Date.now()
  ) {
    throw new Error(
      "invalid_payout_access_token"
    );
  }

  if (!storage) {
    throw new Error(
      "payout_access_token_storage_unavailable"
    );
  }

  storage.setItem(
    key,
    JSON.stringify({
      token:
        normalizedToken,

      expires_at:
        expiry.value
    })
  );
}

export function clearPayoutAccessToken(
  payoutIntentId
) {
  const key =
    buildStorageKey(
      payoutIntentId
    );

  const storage =
    getLocalStorage();

  safelyRemoveItem(
    storage,
    key
  );
}
