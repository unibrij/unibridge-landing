// shared/pay/kyc/providers/didit/result.js

/*
--------------------------------------------------
Didit SDK result normalization

This module normalizes the result returned by the
Didit frontend SDK.

It does NOT normalize Didit results into UniBridge
canonical KYC statuses.

Important:

  Didit "completed"
    != UniBridge KYC "passed"

A completed Didit interaction only means the
provider-side verification flow was submitted or
completed.

The authoritative KYC state must still be
reconciled with the backend.

Examples:

  completed / approved / success
    -> DIDIT_RESULT_TYPE.COMPLETED

  cancelled / canceled
    -> DIDIT_RESULT_TYPE.CANCELLED

  failed / declined / rejected
    -> DIDIT_RESULT_TYPE.FAILED

Unexpected provider values remain UNKNOWN.
--------------------------------------------------
*/

export const DIDIT_RESULT_TYPE =
  Object.freeze({
    UNKNOWN:
      "unknown",

    COMPLETED:
      "completed",

    CANCELLED:
      "cancelled",

    FAILED:
      "failed"
  });


const DIDIT_COMPLETED_STATUSES =
  new Set([
    "completed",
    "approved",
    "success"
  ]);


const DIDIT_CANCELLED_STATUSES =
  new Set([
    "cancelled",
    "canceled"
  ]);


const DIDIT_FAILED_STATUSES =
  new Set([
    "failed",
    "declined",
    "rejected"
  ]);


function normalizeString(
  value
) {
  if (
    typeof value !==
      "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized ||
    null;
}


function normalizeLower(
  value
) {
  return (
    normalizeString(
      value
    )?.toLowerCase() ||
    null
  );
}


/*
--------------------------------------------------
Recognized provider status
--------------------------------------------------
*/

function isRecognizedDiditStatus(
  value
) {
  return (
    DIDIT_COMPLETED_STATUSES.has(
      value
    ) ||
    DIDIT_CANCELLED_STATUSES.has(
      value
    ) ||
    DIDIT_FAILED_STATUSES.has(
      value
    )
  );
}


/*
--------------------------------------------------
Provider status

Didit results observed by the existing UniBridge
flows may expose status in more than one location:

  result.type
  result.status
  result.session.status

Recognized Didit statuses take priority over an
earlier unknown string value.

If no recognized value exists, the first non-empty
provider value is preserved for diagnostics and
forward compatibility.

Only string values are considered valid provider
statuses.
--------------------------------------------------
*/

function resolveProviderStatus(
  result
) {
  if (
    !result ||
    typeof result !==
      "object" ||
    Array.isArray(
      result
    )
  ) {
    return null;
  }

  const candidates =
    [
      normalizeLower(
        result.type
      ),

      normalizeLower(
        result.status
      ),

      normalizeLower(
        result.session?.status
      )
    ].filter(
      Boolean
    );

  const recognized =
    candidates.find(
      isRecognizedDiditStatus
    );

  return (
    recognized ||
    candidates[0] ||
    null
  );
}


/*
--------------------------------------------------
Provider session id

Observed Didit result shapes currently use:

  result.session.sessionId
  result.session.id
  result.session_id

sessionId is also accepted defensively without
changing provider semantics.

Only string identifiers are accepted.
--------------------------------------------------
*/

function resolveProviderSessionId(
  result
) {
  if (
    !result ||
    typeof result !==
      "object" ||
    Array.isArray(
      result
    )
  ) {
    return null;
  }

  return (
    normalizeString(
      result.session?.sessionId
    ) ||
    normalizeString(
      result.session?.id
    ) ||
    normalizeString(
      result.session_id
    ) ||
    normalizeString(
      result.sessionId
    ) ||
    null
  );
}


/*
--------------------------------------------------
Error normalization

Only small diagnostic fields are exposed.

The raw provider result is intentionally not copied
into the normalized result because it may contain
additional provider or identity information that
the shared KYC layer does not need.
--------------------------------------------------
*/

function normalizeDiditError(
  error
) {
  if (!error) {
    return null;
  }

  if (
    typeof error ===
      "string"
  ) {
    const message =
      normalizeString(
        error
      );

    return message
      ? {
          type:
            null,

          message
        }
      : null;
  }

  if (
    typeof error !==
      "object" ||
    Array.isArray(
      error
    )
  ) {
    return null;
  }

  const type =
    normalizeString(
      error.type
    ) ||
    normalizeString(
      error.code
    ) ||
    null;

  const message =
    normalizeString(
      error.message
    ) ||
    null;

  if (
    !type &&
    !message
  ) {
    return null;
  }

  return {
    type,
    message
  };
}


/*
--------------------------------------------------
Result classification

This classification belongs only to the Didit SDK
interaction.

It must never be used as a substitute for backend
KYC reconciliation.
--------------------------------------------------
*/

function classifyDiditResult(
  providerStatus
) {
  if (
    DIDIT_COMPLETED_STATUSES.has(
      providerStatus
    )
  ) {
    return DIDIT_RESULT_TYPE.COMPLETED;
  }

  if (
    DIDIT_CANCELLED_STATUSES.has(
      providerStatus
    )
  ) {
    return DIDIT_RESULT_TYPE.CANCELLED;
  }

  if (
    DIDIT_FAILED_STATUSES.has(
      providerStatus
    )
  ) {
    return DIDIT_RESULT_TYPE.FAILED;
  }

  return DIDIT_RESULT_TYPE.UNKNOWN;
}


/*
--------------------------------------------------
Public normalizer
--------------------------------------------------
*/

export function normalizeDiditResult(
  result
) {
  const providerStatus =
    resolveProviderStatus(
      result
    );

  return {
    type:
      classifyDiditResult(
        providerStatus
      ),

    provider_status:
      providerStatus,

    provider_session_id:
      resolveProviderSessionId(
        result
      ),

    error:
      normalizeDiditError(
        result?.error
      )
  };
}


/*
--------------------------------------------------
Result guards
--------------------------------------------------
*/

export function isDiditCompleted(
  result
) {
  return (
    normalizeDiditResult(
      result
    ).type ===
    DIDIT_RESULT_TYPE.COMPLETED
  );
}


export function isDiditCancelled(
  result
) {
  return (
    normalizeDiditResult(
      result
    ).type ===
    DIDIT_RESULT_TYPE.CANCELLED
  );
}


export function isDiditFailed(
  result
) {
  return (
    normalizeDiditResult(
      result
    ).type ===
    DIDIT_RESULT_TYPE.FAILED
  );
}
