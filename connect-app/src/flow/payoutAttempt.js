// connect-app/src/flow/payoutAttempt.js

const CREATION_STATUS =
  Object.freeze({
    CREATING:
      "creating",

    FAILED:
      "failed",

    READY:
      "ready"
  });

const CREATION_STAGE =
  Object.freeze({
    RESERVED:
      "reserved",

    PREPARED:
      "prepared",

    EXTERNAL_SIDE_EFFECTS_STARTED:
      "external_side_effects_started",

    EXECUTION_WALLET_RESOLVED:
      "execution_wallet_resolved",

    SETTLEMENT_CREATED:
      "settlement_created",

    FUNDING_SESSION_CREATED:
      "funding_session_created",

    REFERENCES_PERSISTED:
      "references_persisted",

    READY:
      "ready"
  });

const SAFE_RETRY_STAGES =
  new Set([
    CREATION_STAGE.RESERVED,
    CREATION_STAGE.PREPARED
  ]);

export const PAYOUT_ATTEMPT_STATE =
  Object.freeze({
    EDITABLE:
      "editable",

    LOCKED_RESUMABLE:
      "locked_resumable",

    LOCKED_RECOVERY:
      "locked_recovery"
  });

function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}

function normalizeLowerString(
  value
) {
  const normalized =
    normalizeString(
      value
    );

  return normalized
    ? normalized.toLowerCase()
    : "";
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
   * Do not include pricing previews, execution
   * lifecycle, settlement data, provider responses,
   * or timestamps.
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

export function resolveSettlementCreationStatus(
  value
) {
  const intent =
    resolveIntentPayload(
      value
    );

  return (
    normalizeLowerString(
      intent
        .settlement_creation_status
    ) ||
    normalizeLowerString(
      intent
        .settlementCreationStatus
    ) ||
    null
  );
}

export function resolveSettlementCreationStage(
  value
) {
  const intent =
    resolveIntentPayload(
      value
    );

  return (
    normalizeLowerString(
      intent
        .settlement_creation_stage
    ) ||
    normalizeLowerString(
      intent
        .settlementCreationStage
    ) ||
    null
  );
}

export function isSafeRetryPayoutAttempt(
  value
) {
  const status =
    resolveSettlementCreationStatus(
      value
    );

  const stage =
    resolveSettlementCreationStage(
      value
    );

  return (
    status ===
      CREATION_STATUS.FAILED &&
    SAFE_RETRY_STAGES.has(
      stage
    )
  );
}

export function resolvePayoutAttemptState(
  value
) {
  const status =
    resolveSettlementCreationStatus(
      value
    );

  const stage =
    resolveSettlementCreationStage(
      value
    );

  const settlementId =
    resolvePayoutIntentSettlementId(
      value
    );

  /*
   * No settlement-creation lifecycle has started.
   *
   * The payout specification is still editable.
   */
  if (
    !status &&
    !stage &&
    !settlementId
  ) {
    return PAYOUT_ATTEMPT_STATE
      .EDITABLE;
  }

  /*
   * Active creation is always locked.
   *
   * Even at an early stage, the user must not mutate
   * the transfer specification while orchestration
   * is currently running.
   */
  if (
    status ===
    CREATION_STATUS.CREATING
  ) {
    return PAYOUT_ATTEMPT_STATE
      .LOCKED_RESUMABLE;
  }

  /*
   * READY is authoritative.
   *
   * Once the backend reports the creation as ready,
   * the existing payout attempt is resumable and
   * its transfer specification must remain locked.
   *
   * Do not require stage === "ready" here because
   * status is the stronger final lifecycle signal.
   */
  if (
    status ===
    CREATION_STATUS.READY
  ) {
    return PAYOUT_ATTEMPT_STATE
      .LOCKED_RESUMABLE;
  }

  /*
   * Backend explicitly permits retry only for a
   * FAILED attempt at reserved/prepared stages.
   *
   * At these stages no unsafe external side-effect
   * boundary has been crossed.
   */
  if (
    isSafeRetryPayoutAttempt(
      value
    )
  ) {
    return PAYOUT_ATTEMPT_STATE
      .EDITABLE;
  }

  /*
   * Any other FAILED state requires recovery.
   *
   * This includes failures at or after external
   * side effects started, as well as malformed or
   * unknown failed stages.
   */
  if (
    status ===
    CREATION_STATUS.FAILED
  ) {
    return PAYOUT_ATTEMPT_STATE
      .LOCKED_RECOVERY;
  }

  /*
   * Legacy or inconsistent state.
   *
   * A settlement reference alone is not enough to
   * prove READY because the backend may reserve the
   * settlement id before persistence.
   *
   * But it is enough to choose the conservative
   * path and prevent automatic replacement.
   */
  if (settlementId) {
    return PAYOUT_ATTEMPT_STATE
      .LOCKED_RECOVERY;
  }

  /*
   * Unknown lifecycle metadata means settlement
   * creation appears to have started, but its safe
   * state cannot be proven.
   */
  if (
    status ||
    stage
  ) {
    return PAYOUT_ATTEMPT_STATE
      .LOCKED_RECOVERY;
  }

  return PAYOUT_ATTEMPT_STATE
    .EDITABLE;
}

export function isPayoutAttemptEditable(
  value
) {
  return (
    resolvePayoutAttemptState(
      value
    ) ===
    PAYOUT_ATTEMPT_STATE.EDITABLE
  );
}

export function isPayoutAttemptLocked(
  value
) {
  return !isPayoutAttemptEditable(
    value
  );
}

export function isPayoutAttemptResumable(
  value
) {
  return (
    resolvePayoutAttemptState(
      value
    ) ===
    PAYOUT_ATTEMPT_STATE
      .LOCKED_RESUMABLE
  );
}

export function requiresPayoutAttemptRecovery(
  value
) {
  return (
    resolvePayoutAttemptState(
      value
    ) ===
    PAYOUT_ATTEMPT_STATE
      .LOCKED_RECOVERY
  );
}

/*
 * Temporary compatibility alias.
 *
 * Existing callers may still import this name.
 *
 * "Committed" here means the attempt is locked
 * against transfer-specification mutation.
 *
 * New code should prefer:
 * isPayoutAttemptLocked()
 */
export function isCommittedPayoutIntent(
  value
) {
  return isPayoutAttemptLocked(
    value
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
   * A locked payout attempt must never be replaced
   * merely because local form data differs.
   *
   * Resume/recovery must operate on the existing
   * attempt instead.
   */
  if (
    isPayoutAttemptLocked(
      intent
    )
  ) {
    return false;
  }

  /*
   * For an editable attempt, fingerprint mismatch
   * means the existing payout intent no longer
   * represents the current transfer specification.
   *
   * Legacy stored flows without a fingerprint are
   * intentionally treated as stale.
   */
  return !doTransferFingerprintsMatch(
    storedFingerprint,
    currentFingerprint
  );
}

export default {
  PAYOUT_ATTEMPT_STATE,
  buildTransferFingerprint,
  resolvePayoutIntentSettlementId,
  resolveSettlementCreationStatus,
  resolveSettlementCreationStage,
  isSafeRetryPayoutAttempt,
  resolvePayoutAttemptState,
  isPayoutAttemptEditable,
  isPayoutAttemptLocked,
  isPayoutAttemptResumable,
  requiresPayoutAttemptRecovery,
  isCommittedPayoutIntent,
  doTransferFingerprintsMatch,
  isStalePreCommitIntent
};
