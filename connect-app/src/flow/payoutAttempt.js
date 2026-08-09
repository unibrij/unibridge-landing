// connect-app/src/flow/payoutAttempt.js

function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}

function normalizeFingerprintValue(
  value
) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  if (
    typeof value ===
    "string"
  ) {
    return value.trim();
  }

  if (
    typeof value ===
      "number" ||
    typeof value ===
      "boolean"
  ) {
    return value;
  }

  if (
    Array.isArray(
      value
    )
  ) {
    return value.map(
      normalizeFingerprintValue
    );
  }

  if (
    typeof value ===
    "object"
  ) {
    return Object.fromEntries(
      Object.keys(
        value
      )
        .sort()
        .map(
          key => [
            key,
            normalizeFingerprintValue(
              value[key]
            )
          ]
        )
        .filter(
          ([, item]) =>
            item !== null
        )
    );
  }

  return String(
    value
  );
}

function resolveIntentPayload(
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
    return {};
  }

  const candidates = [
    value.payout_intent,
    value.payoutIntent,
    value.intent,

    value.data
      ?.payout_intent,

    value.data
      ?.payoutIntent,

    value.data
      ?.intent
  ];

  const nestedIntent =
    candidates.find(
      candidate =>
        candidate &&
        typeof candidate ===
          "object" &&
        !Array.isArray(
          candidate
        ) &&
        Object.keys(
          candidate
        ).length > 0
    );

  return (
    nestedIntent ||
    value
  );
}

export function buildTransferFingerprint({
  route,
  form,
  repeatSourcePayoutIntentId = null
} = {}) {
  const routeId =
    normalizeString(
      route?.id ??
      route?.route_id
    );

  const repeatSourceId =
    normalizeString(
      repeatSourcePayoutIntentId
    );

  /*
   * Fingerprint only the transfer specification
   * controlled by the user.
   *
   * Do not include pricing previews, provider
   * responses, settlement state, timestamps,
   * or other mutable execution metadata.
   */
  const specification =
    normalizeFingerprintValue({
      version:
        1,

      route_id:
        routeId ||
        null,

      repeat_source_payout_intent_id:
        repeatSourceId ||
        null,

      form:
        form &&
        typeof form ===
          "object"
          ? form
          : {}
    });

  return (
    "ub_transfer_v1:" +
    JSON.stringify(
      specification
    )
  );
}

export function resolvePayoutIntentSettlementId(
  value
) {
  const intent =
    resolveIntentPayload(
      value
    );

  return (
    normalizeString(
      intent.settlement_id
    ) ||
    normalizeString(
      intent.settlementId
    ) ||
    normalizeString(
      intent.settlement
        ?.id
    ) ||
    normalizeString(
      intent.settlement
        ?.settlement_id
    ) ||
    normalizeString(
      intent.settlement
        ?.settlementId
    ) ||
    null
  );
}

export function isCommittedPayoutIntent(
  value
) {
  /*
   * UniBridge commitment boundary:
   *
   * once a settlement has been persisted and
   * linked to the payout intent, the transfer
   * specification becomes immutable.
   *
   * This deliberately knows nothing about
   * provider orders, quotes, deposit addresses,
   * or provider-specific lifecycle states.
   */
  return Boolean(
    resolvePayoutIntentSettlementId(
      value
    )
  );
}

export function doTransferFingerprintsMatch(
  storedFingerprint,
  currentFingerprint
) {
  const stored =
    normalizeString(
      storedFingerprint
    );

  const current =
    normalizeString(
      currentFingerprint
    );

  if (
    !stored ||
    !current
  ) {
    return false;
  }

  return stored === current;
}

export function isStalePreCommitIntent({
  intent,
  storedFingerprint,
  currentFingerprint
} = {}) {
  /*
   * A committed payout must never be replaced
   * merely because the local form changed.
   * The UI should be locked instead.
   */
  if (
    isCommittedPayoutIntent(
      intent
    )
  ) {
    return false;
  }

  /*
   * Legacy stored flows without a fingerprint
   * are treated as stale rather than silently
   * reusing an intent whose specification we
   * cannot prove still matches the form.
   */
  return !doTransferFingerprintsMatch(
    storedFingerprint,
    currentFingerprint
  );
}

export default {
  buildTransferFingerprint,
  resolvePayoutIntentSettlementId,
  isCommittedPayoutIntent,
  doTransferFingerprintsMatch,
  isStalePreCommitIntent
};
