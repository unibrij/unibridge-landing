// connect-app/src/flow/flowStorage.js

export const FLOW_STORAGE_KEY =
  "unibridge_connect_flow";

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

function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}

function normalizeStoredFlow(
  value
) {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    return null;
  }

  return {
    ...value,

    connect_session_id:
      normalizeString(
        value.connect_session_id
      ) ||
      null,

    payout_intent_id:
      normalizeString(
        value.payout_intent_id
      ) ||
      null,

    repeat_source_payout_intent_id:
      normalizeString(
        value
          .repeat_source_payout_intent_id
      ) ||
      null,

    route_id:
      normalizeString(
        value.route_id
      ) ||
      null,

    transfer_fingerprint:
      normalizeString(
        value.transfer_fingerprint
      ) ||
      null
  };
}

export function readStoredFlow() {
  const storage =
    getLocalStorage();

  if (!storage) {
    return null;
  }

  try {
    const raw =
      storage.getItem(
        FLOW_STORAGE_KEY
      );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(
        raw
      );

    return normalizeStoredFlow(
      parsed
    );
  }
  catch {
    return null;
  }
}

export function storeFlowSnapshot(
  snapshot
) {
  if (
    !snapshot ||
    typeof snapshot !==
      "object" ||
    Array.isArray(
      snapshot
    )
  ) {
    return;
  }

  const storage =
    getLocalStorage();

  if (!storage) {
    return;
  }

  const normalizedSnapshot =
    normalizeStoredFlow(
      snapshot
    );

  if (!normalizedSnapshot) {
    return;
  }

  try {
    storage.setItem(
      FLOW_STORAGE_KEY,
      JSON.stringify(
        normalizedSnapshot
      )
    );
  }
  catch {
    // Storage may be unavailable, blocked, or full.
  }
}

export function clearStoredPayoutIntent() {
  const storage =
    getLocalStorage();

  if (!storage) {
    return;
  }

  try {
    const raw =
      storage.getItem(
        FLOW_STORAGE_KEY
      );

    if (!raw) {
      return;
    }

    const parsed =
      JSON.parse(
        raw
      );

    const normalizedFlow =
      normalizeStoredFlow(
        parsed
      );

    if (!normalizedFlow) {
      return;
    }

    storage.setItem(
      FLOW_STORAGE_KEY,
      JSON.stringify({
        ...normalizedFlow,

        payout_intent_id:
          null,

        transfer_fingerprint:
          null
      })
    );
  }
  catch {
    // Storage may be unavailable, blocked, or contain invalid data.
  }
}

export function clearStoredFlow() {
  const storage =
    getLocalStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(
      FLOW_STORAGE_KEY
    );
  }
  catch {
    // Storage may be unavailable or blocked.
  }
}
