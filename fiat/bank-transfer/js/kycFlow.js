// fiat/bank-transfer/js/kycFlow.js

import {
  createFiatKyc
} from "./api.js";

import {
  startDiditVerification
} from "./diditSdk.js";

import {
  setStatus,
  markStepDone,
  markStepFailed,
  setPrimaryAction
} from "./status.js";

const DIDIT_CONFIRMATION_RETRY_DELAYS_MS = [
  4000,
  7000,
  12000
];

let diditAutoContinueTimer = null;
let diditConfirmationAttempt = 0;
let diditVerificationSubmitted = false;

function normalizeString(value) {
  return String(value || "").trim();
}

function openExternal(url) {
  const normalized =
    normalizeString(url);

  if (!normalized) {
    return false;
  }

  window.location.href =
    normalized;

  return true;
}

function resolveDiditResultType(result = {}) {
  return normalizeString(
    result.type ||
    result.status ||
    result.session?.status
  ).toLowerCase();
}

export function clearDiditAutoContinue() {
  if (!diditAutoContinueTimer) {
    return;
  }

  window.clearTimeout(
    diditAutoContinueTimer
  );

  diditAutoContinueTimer =
    null;
}

function resetDiditConfirmationState() {
  clearDiditAutoContinue();

  diditVerificationSubmitted =
    false;

  diditConfirmationAttempt =
    0;
}

function scheduleDiditAutoContinue({
  onConfirm
} = {}) {
  clearDiditAutoContinue();

  const delay =
    DIDIT_CONFIRMATION_RETRY_DELAYS_MS[
      diditConfirmationAttempt
    ];

  if (!delay) {
    setStatus({
      kind:
        "warning",

      message:
        "Verification is still being confirmed. This can take a little longer. Please wait and keep this page open."
    });

    setPrimaryAction({
      label:
        "Check again",

      disabled:
        false
    });

    return;
  }

  diditConfirmationAttempt += 1;

  diditAutoContinueTimer =
    window.setTimeout(
      () => {
        diditAutoContinueTimer =
          null;

        setStatus({
          kind:
            "warning",

          message:
            "Checking verification status… Keep this page open."
        });

        if (typeof onConfirm === "function") {
          onConfirm();
        }
      },
      delay
    );
}

function resolveKycUrl(kyc = {}) {
  return (
    normalizeString(kyc.url) ||
    normalizeString(kyc.provider_url) ||
    normalizeString(kyc.provider_reference) ||
    null
  );
}

function persistDiditResult({
  result,
  kyc,
  state,
  persist
} = {}) {
  if (typeof persist !== "function") {
    return;
  }

  persist({
    kyc_didit_result:
      result,

    kyc_didit_status:
      result?.session?.status ||
      result?.type ||
      result?.status ||
      null,

    provider_session_id:
      result?.session?.sessionId ||
      result?.session?.id ||
      result?.session_id ||
      kyc?.provider_session_id ||
      state?.provider_session_id ||
      null
  });
}

function markDiditConfirmationPending({
  message,
  onConfirm
} = {}) {
  diditVerificationSubmitted =
    true;

  setStatus({
    kind:
      "warning",

    message:
      message ||
      "Identity verification is being reviewed. Please wait while we confirm your status. Keep this page open."
  });

  setPrimaryAction({
    label:
      "Waiting…",

    disabled:
      true
  });

  scheduleDiditAutoContinue({
    onConfirm
  });
}

function handleDiditComplete({
  result,
  kyc,
  state,
  persist,
  onConfirm
} = {}) {
  persistDiditResult({
    result,
    kyc,
    state,
    persist
  });

  const resultType =
    resolveDiditResultType(
      result
    );

  if (
    resultType === "completed" ||
    resultType === "approved" ||
    resultType === "success"
  ) {
    diditConfirmationAttempt =
      0;

    markDiditConfirmationPending({
      message:
        "Identity verification submitted. Please wait a few seconds while we confirm your status. Keep this page open.",

      onConfirm
    });

    return;
  }

  if (
    resultType === "cancelled" ||
    resultType === "canceled"
  ) {
    resetDiditConfirmationState();

    setStatus({
      kind:
        "warning",

      message:
        "Identity verification was cancelled. You can try again."
    });

    setPrimaryAction({
      label:
        "Retry verification",

      disabled:
        false
    });

    return;
  }

  if (
    resultType === "failed" ||
    resultType === "declined" ||
    resultType === "rejected"
  ) {
    resetDiditConfirmationState();

    setStatus({
      kind:
        "failed",

      message:
        result?.error?.message ||
        "Identity verification failed."
    });

    markStepFailed(
      "kyc"
    );

    setPrimaryAction({
      label:
        "Retry verification",

      disabled:
        false
    });

    return;
  }

  markDiditConfirmationPending({
    message:
      "Identity verification is being reviewed. Please wait while we confirm your status. Keep this page open.",

    onConfirm
  });
}

function handleDiditStateChange({
  sdkState,
  error
} = {}) {
  const stateName =
    normalizeString(
      sdkState
    ).toLowerCase();

  if (stateName === "loading") {
    setStatus({
      kind:
        "warning",

      message:
        "Opening identity verification…"
    });

    return;
  }

  if (stateName === "ready") {
    setStatus({
      kind:
        "warning",

      message:
        "Complete identity verification in this window."
    });

    return;
  }

  if (stateName === "error") {
    resetDiditConfirmationState();

    setStatus({
      kind:
        "failed",

      message:
        error ||
        "Identity verification could not be opened."
    });

    markStepFailed(
      "kyc"
    );

    setPrimaryAction({
      label:
        "Retry verification",

      disabled:
        false
    });
  }
}

async function openKycVerification({
  kyc,
  state,
  persist,
  onConfirm
} = {}) {
  if (diditVerificationSubmitted) {
    setStatus({
      kind:
        "warning",

      message:
        "Verification is still being confirmed. Keep this page open."
    });

    scheduleDiditAutoContinue({
      onConfirm
    });

    return {
      ...kyc,

      redirected:
        true,

      confirmation_pending:
        true
    };
  }

  const kycUrl =
    resolveKycUrl(
      kyc
    );

  if (!kycUrl) {
    throw new Error(
      kyc?.status
        ? `kyc_not_ready_${kyc.status}`
        : "kyc_not_ready"
    );
  }

  setStatus({
    kind:
      "warning",

    message:
      "Opening identity verification…"
  });

  try {
    await startDiditVerification({
      url:
        kycUrl,

      onComplete:
        (result = {}) => {
          handleDiditComplete({
            result,
            kyc,
            state,
            persist,
            onConfirm
          });
        },

      onStateChange:
        (sdkState, error) => {
          handleDiditStateChange({
            sdkState,
            error
          });
        }
    });

    return {
      ...kyc,

      redirected:
        true,

      sdk:
        true
    };
  } catch (sdkErr) {
    console.error(
      "DIDIT_SDK_START_FAILED",
      sdkErr
    );

    setStatus({
      kind:
        "warning",

      message:
        "Opening identity verification in a secure page…"
    });

    if (!openExternal(kycUrl)) {
      throw new Error(
        "missing_kyc_redirect_url"
      );
    }

    return {
      ...kyc,

      redirected:
        true,

      sdk:
        false
    };
  }
}

export async function runKyc({
  settlementId,
  state,
  persist,
  onConfirm
} = {}) {
  if (!settlementId) {
    throw new Error(
      "missing_settlement_id"
    );
  }

  const kyc =
    await createFiatKyc({
      settlement_id:
        settlementId,

      bank_customer_ref:
        state?.bank_customer_ref,

      bank_verified_identity_ref:
        state?.bank_verified_identity_ref || null,

      source_country:
        state?.source_country,

      source_rail:
        state?.source_rail
    });

  if (typeof persist === "function") {
    persist({
      kyc_status:
        kyc.status,

      kyc_reused:
        Boolean(kyc.reused),

      kyc_session_id:
        kyc.kyc_session_id ||
        kyc.session_id ||
        null,

      provider_session_id:
        kyc.provider_session_id || null,

      bank_customer_ref:
        kyc.bank_customer_ref ||
        state?.bank_customer_ref,

      bank_verified_identity_ref:
        kyc.bank_verified_identity_ref ||
        state?.bank_verified_identity_ref ||
        null
    });
  }

  const kycStatus =
    normalizeString(
      kyc.status
    ).toLowerCase();

  if (
    kyc.reused ||
    kycStatus === "passed"
  ) {
    resetDiditConfirmationState();

    markStepDone(
      "kyc"
    );

    return kyc;
  }

  return openKycVerification({
    kyc,
    state,
    persist,
    onConfirm
  });
}
