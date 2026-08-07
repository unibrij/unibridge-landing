// connect-app/src/flow/payoutAccessTokenStorage.js

const STORAGE_KEY_PREFIX =
  "unibridge_payout_access_token:";

const LAST_ACCESS_PAYOUT_INTENT_ID_KEY =
  "unibridge_last_access_payout_intent_id";

const PAYOUT_ACCESS_TOKEN_PATTERN =
  /^ub_pat_[A-Za-z0-9_-]{43}$/;

function normalizeString(
  value
) {
  return String(
    value ||
    ""
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

function readLastAccessPayoutIntentId() {
  const storage =
    getLocalStorage();

  if (!storage) {
    return null;
  }

  try {
    return (
      normalizeString(
        storage.getItem(
          LAST_ACCESS_PAYOUT_INTENT_ID_KEY
        )
      ) ||
      null
    );
  }
  catch {
    return null;
  }
}

function storeLastAccessPayoutIntentId(
  payoutIntentId
) {
  const intentId =
    normalizeString(
      payoutIntentId
    );

  const storage =
    getLocalStorage();

  if (
    !intentId ||
    !storage
  ) {
    return;
  }

  try {
    storage.setItem(
      LAST_ACCESS_PAYOUT_INTENT_ID_KEY,
      intentId
    );
  }
  catch {
    // The primary payout token may still have been stored.
    // Do not fail token storage only because the pointer
    // could not be updated.
  }
}

function clearLastAccessPayoutIntentIdIfMatches(
  payoutIntentId
) {
  const intentId =
    normalizeString(
      payoutIntentId
    );

  if (!intentId) {
    return;
  }

  const storage =
    getLocalStorage();

  if (!storage) {
    return;
  }

  try {
    const current =
      normalizeString(
        storage.getItem(
          LAST_ACCESS_PAYOUT_INTENT_ID_KEY
        )
      );

    if (
      current ===
      intentId
    ) {
      storage.removeItem(
        LAST_ACCESS_PAYOUT_INTENT_ID_KEY
      );
    }
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

      clearLastAccessPayoutIntentIdIfMatches(
        payoutIntentId
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

    clearLastAccessPayoutIntentIdIfMatches(
      payoutIntentId
    );

    return null;
  }
}

export function readLastPayoutAccessToken() {
  const payoutIntentId =
    readLastAccessPayoutIntentId();

  if (!payoutIntentId) {
    return null;
  }

  const access =
    readPayoutAccessToken(
      payoutIntentId
    );

  if (!access) {
    clearLastAccessPayoutIntentIdIfMatches(
      payoutIntentId
    );

    return null;
  }

  return {
    payout_intent_id:
      payoutIntentId,

    token:
      access.token,

    expires_at:
      access.expires_at
  };
}

export function storePayoutAccessToken({
  payoutIntentId,
  token,
  expiresAt
}) {
  const intentId =
    normalizeString(
      payoutIntentId
    );

  const key =
    buildStorageKey(
      intentId
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
    !intentId ||
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

  try {
    storage.setItem(
      key,
      JSON.stringify({
        token:
          normalizedToken,

        expires_at:
          expiry.value
      })
    );

    storeLastAccessPayoutIntentId(
      intentId
    );
  }
  catch {
    throw new Error(
      "payout_access_token_storage_unavailable"
    );
  }
}

export function clearPayoutAccessToken(
  payoutIntentId
) {
  const intentId =
    normalizeString(
      payoutIntentId
    );

  const key =
    buildStorageKey(
      intentId
    );

  const storage =
    getLocalStorage();

  safelyRemoveItem(
    storage,
    key
  );

  clearLastAccessPayoutIntentIdIfMatches(
    intentId
  );
}
