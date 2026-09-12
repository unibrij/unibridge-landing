// shared/pay/kyc/kycStatus.js

/*
--------------------------------------------------
Canonical KYC statuses

These statuses represent the UniBridge
application-level KYC session state.

The backend is authoritative for canonical KYC
state.

Current backend lifecycle:

  created
    -> pending
    -> passed | failed

Provider-specific results must not be treated as
canonical KYC status directly.

Examples:

Didit:
- "approved" is normalized by the backend to "passed"
- "declined" is normalized by the backend to "failed"
- "not started" is normalized by the backend to "created"
- other non-terminal provider states are normalized
  by the backend to "pending"

A provider SDK event such as user cancellation is
not itself a canonical KYC status. The application
may handle that event locally, then reconcile with
the backend.

Provider-specific onboarding states, including
Stripe requirements and Bridge customer KYC state,
remain outside this domain.

UNKNOWN is a local defensive fallback and is not a
persisted canonical backend state.
--------------------------------------------------
*/

export const KYC_STATUS =
  Object.freeze({
    UNKNOWN:
      "unknown",

    CREATED:
      "created",

    PENDING:
      "pending",

    PASSED:
      "passed",

    FAILED:
      "failed"
  });


const CANONICAL_KYC_STATUSES =
  new Set([
    KYC_STATUS.CREATED,
    KYC_STATUS.PENDING,
    KYC_STATUS.PASSED,
    KYC_STATUS.FAILED
  ]);


/*
--------------------------------------------------
Normalization
--------------------------------------------------
*/

function normalizeString(
  value
) {
  return String(
    value ??
    ""
  )
    .trim()
    .toLowerCase();
}


export function normalizeKycStatus(
  value
) {
  const normalized =
    normalizeString(
      value
    );

  if (
    CANONICAL_KYC_STATUSES.has(
      normalized
    )
  ) {
    return normalized;
  }

  return KYC_STATUS.UNKNOWN;
}


/*
--------------------------------------------------
Status guards
--------------------------------------------------
*/

export function isKycCreated(
  value
) {
  return (
    normalizeKycStatus(
      value
    ) ===
    KYC_STATUS.CREATED
  );
}


export function isKycPending(
  value
) {
  return (
    normalizeKycStatus(
      value
    ) ===
    KYC_STATUS.PENDING
  );
}


export function isKycPassed(
  value
) {
  return (
    normalizeKycStatus(
      value
    ) ===
    KYC_STATUS.PASSED
  );
}


export function isKycFailed(
  value
) {
  return (
    normalizeKycStatus(
      value
    ) ===
    KYC_STATUS.FAILED
  );
}


/*
--------------------------------------------------
Lifecycle helpers

CREATED means a KYC session exists but has not
reached a backend-reported processing state yet.

PENDING means verification is still being
processed or awaiting a terminal provider result.

PASSED and FAILED are terminal canonical states.

Retry policy intentionally does not live here.
--------------------------------------------------
*/

export function isKycInProgress(
  value
) {
  const status =
    normalizeKycStatus(
      value
    );

  return (
    status ===
      KYC_STATUS.CREATED ||
    status ===
      KYC_STATUS.PENDING
  );
}


export function isKycFinished(
  value
) {
  const status =
    normalizeKycStatus(
      value
    );

  return (
    status ===
      KYC_STATUS.PASSED ||
    status ===
      KYC_STATUS.FAILED
  );
}
