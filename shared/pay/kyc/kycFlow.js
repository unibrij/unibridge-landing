// shared/pay/kyc/kycFlow.js

import {
  KYC_STATUS,
  normalizeKycStatus
} from "./kycStatus.js";

export const KYC_FLOW_OUTCOME =
  Object.freeze({
    PASSED: "passed",
    FAILED: "failed",
    VERIFICATION_REQUIRED:
      "verification_required",
    VERIFICATION_STARTED:
      "verification_started",
    VERIFICATION_CANCELLED:
      "verification_cancelled",
    PROVIDER_FAILED:
      "provider_failed",
    PROVIDER_ERROR:
      "provider_error",
    CONFIRMATION_PENDING:
      "confirmation_pending",
    UNKNOWN:
      "unknown"
  });

export const KYC_NEXT_ACTION =
  Object.freeze({
    UNKNOWN: "unknown",
    NONE: "none",
    VERIFY: "verify",
    WAIT: "wait"
  });

export const KYC_PROVIDER_RESULT_TYPE =
  Object.freeze({
    UNKNOWN: "unknown",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
    FAILED: "failed"
  });

const DEFAULT_RETRY_DELAYS =
  Object.freeze([
    4000,
    7000,
    12000
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

  return (
    value.trim() ||
    null
  );
}

function normalizeError(
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
          code: null,
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

  const code =
    normalizeString(
      error.code
    ) ||
    normalizeString(
      error.type
    );

  const message =
    normalizeString(
      error.message
    );

  return (
    code ||
    message
  )
    ? {
        code:
          code || null,
        message:
          message || null
      }
    : null;
}

function normalizeNextAction(
  session
) {
  const explicit =
    normalizeString(
      session?.next_action
    )?.toLowerCase();

  if (
    explicit ===
      KYC_NEXT_ACTION.NONE ||
    explicit ===
      KYC_NEXT_ACTION.VERIFY ||
    explicit ===
      KYC_NEXT_ACTION.WAIT
  ) {
    return explicit;
  }

  if (
    session
      ?.verification_required ===
    true
  ) {
    return KYC_NEXT_ACTION.VERIFY;
  }

  if (
    session
      ?.verification_required ===
    false
  ) {
    return KYC_NEXT_ACTION.WAIT;
  }

  return KYC_NEXT_ACTION.UNKNOWN;
}

function resolveVerificationUrl(
  session
) {
  return (
    normalizeString(
      session
        ?.verification_url
    ) ||
    normalizeString(
      session?.url
    ) ||
    normalizeString(
      session
        ?.provider_url
    ) ||
    null
  );
}

function normalizeSession(
  session
) {
  if (
    !session ||
    typeof session !==
      "object" ||
    Array.isArray(
      session
    )
  ) {
    return {
      status:
        KYC_STATUS.UNKNOWN,
      next_action:
        KYC_NEXT_ACTION.UNKNOWN,
      kyc_session_id:
        null,
      provider_session_id:
        null,
      provider:
        null,
      verification_url:
        null,
      reused:
        false
    };
  }

  const status =
    normalizeKycStatus(
      session.status
    );

  const terminal =
    status ===
      KYC_STATUS.PASSED ||
    status ===
      KYC_STATUS.FAILED;

  return {
    status,

    next_action:
      terminal
        ? KYC_NEXT_ACTION.NONE
        : normalizeNextAction(
            session
          ),

    kyc_session_id:
      normalizeString(
        session
          .kyc_session_id
      ),

    provider_session_id:
      normalizeString(
        session
          .provider_session_id
      ),

    provider:
      normalizeString(
        session.provider
      ),

    verification_url:
      resolveVerificationUrl(
        session
      ),

    reused:
      Boolean(
        session.reused
      )
  };
}

function mergeSession(
  previous,
  next
) {
  const current =
    normalizeSession(
      previous
    );

  const updated =
    normalizeSession(
      next
    );

  return {
    ...updated,

    kyc_session_id:
      updated
        .kyc_session_id ||
      current
        .kyc_session_id,

    provider:
      updated.provider ||
      current.provider
  };
}

function normalizeProviderResult(
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
    return {
      type:
        KYC_PROVIDER_RESULT_TYPE
          .UNKNOWN,
      provider_status:
        null,
      provider_session_id:
        null,
      error:
        null
    };
  }

  const type =
    normalizeString(
      result.type
    )?.toLowerCase();

  return {
    type:
      Object.values(
        KYC_PROVIDER_RESULT_TYPE
      ).includes(type)
        ? type
        : KYC_PROVIDER_RESULT_TYPE
            .UNKNOWN,

    provider_status:
      normalizeString(
        result
          .provider_status
      ),

    provider_session_id:
      normalizeString(
        result
          .provider_session_id
      ),

    error:
      normalizeError(
        result.error
      )
  };
}

function normalizeRetryDelays(
  value
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [
      ...DEFAULT_RETRY_DELAYS
    ];
  }

  return value.filter(
    (delay) =>
      Number.isFinite(
        delay
      ) &&
      delay >= 0
  );
}

function wait(
  delay
) {
  return new Promise(
    (resolve) =>
      globalThis.setTimeout(
        resolve,
        delay
      )
  );
}

function buildResult({
  outcome,
  session,
  providerResult = null,
  error = null,
  confirmationAttempts = 0,
  completion = null
}) {
  const normalized =
    normalizeSession(
      session
    );

  return {
    outcome:
      outcome ||
      KYC_FLOW_OUTCOME.UNKNOWN,

    status:
      normalized.status,

    next_action:
      normalized.next_action,

    session:
      normalized,

    provider_result:
      providerResult,

    error:
      normalizeError(
        error
      ),

    confirmation_attempts:
      confirmationAttempts,

    completion
  };
}

async function reconcileWithRetries({
  session,
  reconcileSession,
  providerResult = null,
  retryDelays
}) {
  let current =
    normalizeSession(
      session
    );

  if (
    !current
      .kyc_session_id
  ) {
    return buildResult({
      outcome:
        KYC_FLOW_OUTCOME.UNKNOWN,
      session:
        current,
      providerResult,
      error:
        "kyc_session_id_missing"
    });
  }

  let attempts =
    0;

  let lastError =
    null;

  let reconciledAtLeastOnce =
    false;

  for (
    const delay of
    normalizeRetryDelays(
      retryDelays
    )
  ) {
    await wait(
      delay
    );

    attempts += 1;

    try {
      current =
        mergeSession(
          current,
          await reconcileSession({
            kyc_session_id:
              current
                .kyc_session_id,
            attempt:
              attempts
          })
        );

      reconciledAtLeastOnce =
        true;

      lastError =
        null;
    } catch (error) {
      lastError =
        error;

      continue;
    }

    if (
      current.status ===
      KYC_STATUS.PASSED
    ) {
      return buildResult({
        outcome:
          KYC_FLOW_OUTCOME.PASSED,
        session:
          current,
        providerResult,
        confirmationAttempts:
          attempts
      });
    }

    if (
      current.status ===
      KYC_STATUS.FAILED
    ) {
      return buildResult({
        outcome:
          KYC_FLOW_OUTCOME.FAILED,
        session:
          current,
        providerResult,
        confirmationAttempts:
          attempts
      });
    }

    if (
      current.status ===
      KYC_STATUS.UNKNOWN
    ) {
      return buildResult({
        outcome:
          KYC_FLOW_OUTCOME.UNKNOWN,
        session:
          current,
        providerResult,
        error:
          "kyc_reconcile_status_unknown",
        confirmationAttempts:
          attempts
      });
    }

    if (
      current.next_action ===
      KYC_NEXT_ACTION.VERIFY
    ) {
      if (
        !current
          .verification_url
      ) {
        return buildResult({
          outcome:
            KYC_FLOW_OUTCOME.UNKNOWN,
          session:
            current,
          providerResult,
          error:
            "kyc_verification_url_missing",
          confirmationAttempts:
            attempts
        });
      }

      return buildResult({
        outcome:
          KYC_FLOW_OUTCOME
            .VERIFICATION_REQUIRED,
        session:
          current,
        providerResult,
        confirmationAttempts:
          attempts
      });
    }

    if (
      current.next_action !==
      KYC_NEXT_ACTION.WAIT
    ) {
      return buildResult({
        outcome:
          KYC_FLOW_OUTCOME.UNKNOWN,
        session:
          current,
        providerResult,
        error:
          current
            .next_action ===
          KYC_NEXT_ACTION.UNKNOWN
            ? "kyc_next_action_unknown"
            : "kyc_next_action_invalid",
        confirmationAttempts:
          attempts
      });
    }
  }

  const unresolvedSession =
    providerResult &&
    !reconciledAtLeastOnce
      ? {
          ...current,

          next_action:
            KYC_NEXT_ACTION.UNKNOWN,

          verification_url:
            null
        }
      : current;

  return buildResult({
    outcome:
      KYC_FLOW_OUTCOME
        .CONFIRMATION_PENDING,
    session:
      unresolvedSession,
    providerResult,
    error:
      lastError,
    confirmationAttempts:
      attempts
  });
}

function createProviderCompletion({
  session,
  reconcileSession,
  normalizeResult,
  retryDelays
}) {
  let settled =
    false;

  let started =
    false;

  let resolveCompletion;

  const completion =
    new Promise(
      (resolve) => {
        resolveCompletion =
          resolve;
      }
    );

  const settle =
    (result) => {
      if (settled) {
        return;
      }

      settled =
        true;

      resolveCompletion(
        result
      );
    };

  const onComplete =
    async (
      rawResult = {}
    ) => {
      if (
        settled ||
        started
      ) {
        return;
      }

      started =
        true;

      let providerResult;

      try {
        providerResult =
          normalizeProviderResult(
            normalizeResult(
              rawResult
            )
          );
      } catch (error) {
        settle(
          buildResult({
            outcome:
              KYC_FLOW_OUTCOME
                .PROVIDER_ERROR,
            session,
            error
          })
        );

        return;
      }

      if (
        providerResult.type ===
        KYC_PROVIDER_RESULT_TYPE
          .CANCELLED
      ) {
        settle(
          buildResult({
            outcome:
              KYC_FLOW_OUTCOME
                .VERIFICATION_CANCELLED,
            session,
            providerResult
          })
        );

        return;
      }

      if (
        providerResult.type ===
        KYC_PROVIDER_RESULT_TYPE
          .FAILED
      ) {
        settle(
          buildResult({
            outcome:
              KYC_FLOW_OUTCOME
                .PROVIDER_FAILED,
            session,
            providerResult,
            error:
              providerResult.error
          })
        );

        return;
      }

      const reconciled =
        await reconcileWithRetries({
          session,
          reconcileSession,
          providerResult,
          retryDelays
        });

      settle(
        reconciled
      );
    };

  const onError =
    (error) => {
      if (
        settled ||
        started
      ) {
        return;
      }

      settle(
        buildResult({
          outcome:
            KYC_FLOW_OUTCOME
              .PROVIDER_ERROR,
          session,
          error:
            error ||
            "kyc_provider_verification_error"
        })
      );
    };

  return {
    completion,
    onComplete,
    onError
  };
}

export async function runKycFlow({
  createSession,
  reconcileSession,
  startVerification,
  normalizeProviderResult:
    normalizeResult,
  confirmationRetryDelaysMs
} = {}) {
  if (
    typeof createSession !==
    "function"
  ) {
    throw new Error(
      "kyc_create_session_required"
    );
  }

  const session =
    normalizeSession(
      await createSession()
    );

  if (
    session.status ===
    KYC_STATUS.PASSED
  ) {
    return buildResult({
      outcome:
        KYC_FLOW_OUTCOME.PASSED,
      session
    });
  }

  if (
    session.status ===
    KYC_STATUS.FAILED
  ) {
    return buildResult({
      outcome:
        KYC_FLOW_OUTCOME.FAILED,
      session
    });
  }

  if (
    session.status !==
      KYC_STATUS.CREATED &&
    session.status !==
      KYC_STATUS.PENDING
  ) {
    return buildResult({
      outcome:
        KYC_FLOW_OUTCOME.UNKNOWN,
      session,
      error:
        "kyc_status_unknown"
    });
  }

  if (
    !session
      .kyc_session_id
  ) {
    return buildResult({
      outcome:
        KYC_FLOW_OUTCOME.UNKNOWN,
      session,
      error:
        "kyc_session_id_missing"
    });
  }

  if (
    session.next_action ===
    KYC_NEXT_ACTION.WAIT
  ) {
    if (
      typeof reconcileSession !==
      "function"
    ) {
      throw new Error(
        "kyc_reconcile_session_required"
      );
    }

    const completion =
      reconcileWithRetries({
        session,
        reconcileSession,
        retryDelays:
          confirmationRetryDelaysMs
      });

    return buildResult({
      outcome:
        KYC_FLOW_OUTCOME
          .CONFIRMATION_PENDING,
      session,
      completion
    });
  }

  if (
    session.next_action ===
    KYC_NEXT_ACTION.VERIFY
  ) {
    if (
      typeof reconcileSession !==
      "function"
    ) {
      throw new Error(
        "kyc_reconcile_session_required"
      );
    }

    if (
      typeof startVerification !==
      "function"
    ) {
      throw new Error(
        "kyc_start_verification_required"
      );
    }

    if (
      typeof normalizeResult !==
      "function"
    ) {
      throw new Error(
        "kyc_normalize_provider_result_required"
      );
    }

    if (
      !session
        .verification_url
    ) {
      return buildResult({
        outcome:
          KYC_FLOW_OUTCOME.UNKNOWN,
        session,
        error:
          "kyc_verification_url_missing"
      });
    }

    const provider =
      createProviderCompletion({
        session,
        reconcileSession,
        normalizeResult,
        retryDelays:
          confirmationRetryDelaysMs
      });

    try {
      await startVerification({
        url:
          session
            .verification_url,
        onComplete:
          provider.onComplete,
        onError:
          provider.onError
      });
    } catch (error) {
      return buildResult({
        outcome:
          KYC_FLOW_OUTCOME
            .PROVIDER_ERROR,
        session,
        error
      });
    }

    return buildResult({
      outcome:
        KYC_FLOW_OUTCOME
          .VERIFICATION_STARTED,
      session,
      completion:
        provider.completion
    });
  }

  return buildResult({
    outcome:
      KYC_FLOW_OUTCOME.UNKNOWN,
    session,
    error:
      session.next_action ===
      KYC_NEXT_ACTION.UNKNOWN
        ? "kyc_next_action_unknown"
        : "kyc_next_action_invalid"
  });
}
