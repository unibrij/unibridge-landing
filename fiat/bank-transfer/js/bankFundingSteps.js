// fiat/bank-transfer/js/bankFundingSteps.js

import {
  createBridgeTos,
  createBridgeCustomer,
  createBridgeBankTransfer
} from "./api.js";

import {
  renderBankInstructions
} from "./instructions.js";

import {
  requireCustomerProfile
} from "./customerProfile.js";

import {
  runKyc
} from "./kycFlow.js";

import {
  setStatus,
  setActiveStep,
  markStepDone,
  markStepFailed,
  showWaitingForFunding
} from "./status.js";

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeLower(value) {
  return normalizeString(value).toLowerCase();
}

function isReturnedFromBridgeTos(query = {}) {
  return (
    query.tos_accepted === "1" ||
    query.tos_accepted === "true"
  );
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

function resolveTosUrl(tos = {}) {
  return (
    normalizeString(tos.url) ||
    normalizeString(tos.tos_url) ||
    normalizeString(tos.link) ||
    normalizeString(tos.redirect_url) ||
    normalizeString(tos.acceptance_url) ||
    normalizeString(tos.bridge_tos_url) ||
    null
  );
}

function resolveTosStatus(tos = {}) {
  return normalizeString(
    tos.status ||
    tos.tos_status ||
    tos.bridge_tos_status ||
    tos.customer_tos_status
  ).toLowerCase();
}

function isAcceptedTosStatus(status) {
  const normalized =
    normalizeString(status).toLowerCase();

  return [
    "accepted",
    "approved",
    "complete",
    "completed"
  ].includes(
    normalized
  );
}

function shouldSkipTos({
  state = {}
} = {}) {
  return Boolean(
    state.tos_accepted === true &&
    state.bridge_tos_status === "accepted"
  );
}

function isBridgeTosNotAcceptedError(err = {}) {
  const message =
    normalizeString(
      err.message ||
      err.error?.message ||
      err.error
    );

  const code =
    normalizeString(
      err.code ||
      err.error?.code
    );

  return (
    message === "bridge_tos_not_accepted" ||
    code === "bridge_tos_not_accepted"
  );
}

function readNested(value, path = []) {
  let current =
    value;

  for (const key of path) {
    if (
      !current ||
      typeof current !== "object"
    ) {
      return null;
    }

    current =
      current[key];
  }

  return current;
}

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  return [];
}

function resolveBridgeCustomerStatus(customer = {}) {
  return normalizeLower(
    customer.status ||
    customer.bridge_customer_status ||
    readNested(customer, ["customer", "status"]) ||
    readNested(customer, ["bridge_customer", "status"]) ||
    readNested(customer, ["readiness", "status"])
  );
}

function resolveBridgeCustomerId(customer = {}) {
  return (
    normalizeString(customer.bridge_customer_id) ||
    normalizeString(readNested(customer, ["customer", "id"])) ||
    normalizeString(readNested(customer, ["bridge_customer", "id"])) ||
    normalizeString(readNested(customer, ["id"])) ||
    null
  );
}

function resolveBridgeCustomerKycStatus(customer = {}) {
  return (
    normalizeString(customer.kyc_status) ||
    normalizeString(customer.bridge_customer_kyc_status) ||
    normalizeString(readNested(customer, ["customer", "kyc_status"])) ||
    null
  );
}

function resolveBridgeCustomerTosStatus(customer = {}) {
  return (
    normalizeString(customer.tos_status) ||
    normalizeString(customer.bridge_customer_tos_status) ||
    normalizeString(readNested(customer, ["customer", "tos_status"])) ||
    null
  );
}

function resolveRejectionReasons(customer = {}) {
  return [
    ...normalizeArray(customer.rejection_reasons),
    ...normalizeArray(customer.reasons),
    ...normalizeArray(
      readNested(customer, [
        "customer",
        "rejection_reasons"
      ])
    ),
    ...normalizeArray(
      readNested(customer, [
        "bridge_customer",
        "rejection_reasons"
      ])
    ),
    ...normalizeArray(
      readNested(customer, [
        "readiness",
        "rejection_reasons"
      ])
    )
  ];
}

function resolveIssues(customer = {}) {
  return [
    ...normalizeArray(customer.issues),
    ...normalizeArray(
      readNested(customer, [
        "requirements",
        "issues"
      ])
    ),
    ...normalizeArray(
      readNested(customer, [
        "readiness",
        "issues"
      ])
    )
  ];
}

function stringifySafe(value) {
  try {
    return JSON.stringify(value || null);
  } catch {
    return null;
  }
}

function hasDuplicateCustomerIssue(customer = {}) {
  const issues =
    resolveIssues(customer);

  const rejectionReasons =
    resolveRejectionReasons(customer);

  const joined =
    [
      ...issues,
      ...rejectionReasons
    ]
      .map(item => {
        if (typeof item === "string") {
          return item;
        }

        return stringifySafe(item) || "";
      })
      .join(" ")
      .toLowerCase();

  return joined.includes(
    "duplicate_customer_detected"
  );
}

function isRejectedBridgeCustomer(customer = {}) {
  const status =
    resolveBridgeCustomerStatus(customer);

  const rejectionReasons =
    resolveRejectionReasons(customer);

  return (
    status === "rejected" ||
    status === "failed" ||
    hasDuplicateCustomerIssue(customer) ||
    rejectionReasons.length > 0
  );
}

function resolveErrorStatus(err = {}) {
  return normalizeLower(
    err.status ||
    err.statusCode ||
    err.codeStatus ||
    err.error?.status ||
    err.error?.statusCode ||
    err.response?.status ||
    err.response?.statusCode ||
    err.response?.data?.status ||
    err.data?.status
  );
}

function resolveErrorCode(err = {}) {
  return normalizeLower(
    err.code ||
    err.error?.code ||
    err.response?.data?.code ||
    err.data?.code
  );
}

function resolveErrorMessage(err = {}) {
  return normalizeLower(
    err.message ||
    err.error?.message ||
    err.response?.data?.message ||
    err.data?.message ||
    err.error
  );
}

function resolveReadableErrorMessage(err = {}) {
  return (
    normalizeString(err.message) ||
    normalizeString(err.error?.message) ||
    normalizeString(err.response?.data?.message) ||
    normalizeString(err.data?.message) ||
    normalizeString(err.error) ||
    "bridge_bank_transfer_create_failed"
  );
}

function isBridgeCustomerRejectedError(err = {}) {
  const message =
    resolveErrorMessage(err);

  const code =
    resolveErrorCode(err);

  const status =
    resolveErrorStatus(err);

  return (
    status === "409" ||
    status === "conflict" ||
    status === "rejected" ||
    code === "409" ||
    code === "conflict" ||
    code === "bridge_customer_rejected" ||
    code === "duplicate_customer_detected" ||
    message.includes("bridge_customer_rejected") ||
    message.includes("duplicate_customer_detected") ||
    message.includes("your information could not be verified")
  );
}

function resolveCustomerFromError(err = {}) {
  return (
    err.response?.data ||
    err.data ||
    err.response ||
    err.error ||
    err
  );
}

function resolveUserFacingBridgeCustomerMessage(customer = {}) {
  if (hasDuplicateCustomerIssue(customer)) {
    return "We could not verify this bank-transfer profile. Please try another verified account or contact support.";
  }

  const reason =
    resolveRejectionReasons(customer)
      .map(item => {
        if (typeof item === "string") {
          return item;
        }

        return (
          normalizeString(item.reason) ||
          normalizeString(item.message) ||
          normalizeString(item.developer_reason)
        );
      })
      .find(Boolean);

  return (
    reason ||
    "We could not verify this bank-transfer profile. Please try another verified account or contact support."
  );
}

function resolveUserFacingBankTransferMessage(err = {}) {
  const raw =
    resolveReadableErrorMessage(err);

  const status =
    resolveErrorStatus(err);

  const code =
    resolveErrorCode(err);

  if (
    raw === "bridge_bank_transfer_create_failed" ||
    status === "409" ||
    status === "conflict" ||
    code === "409" ||
    code === "conflict"
  ) {
    return "Your funding profile is not ready for bank-transfer instructions yet. Please refresh status or contact support.";
  }

  return raw;
}

function clearInstructionsBox(instructionsBox) {
  if (!instructionsBox) {
    return;
  }

  instructionsBox.innerHTML =
    "";

  instructionsBox.classList.add(
    "hidden"
  );
}

function buildBridgeCustomerRejectedResult(customer = {}) {
  return {
    ok:
      false,

    retryable:
      true,

    blocked:
      true,

    step:
      "customer",

    error:
      "bridge_customer_rejected",

    bridge_customer_id:
      resolveBridgeCustomerId(customer),

    bridge_customer_status:
      resolveBridgeCustomerStatus(customer) || "rejected",

    reason:
      resolveUserFacingBridgeCustomerMessage(customer),

    issues:
      resolveIssues(customer),

    rejection_reasons:
      resolveRejectionReasons(customer)
  };
}

function buildBankTransferCreateFailedResult(err = {}) {
  return {
    ok:
      false,

    retryable:
      true,

    blocked:
      true,

    step:
      "instructions",

    error:
      "bridge_bank_transfer_create_failed",

    status:
      resolveErrorStatus(err) || null,

    code:
      resolveErrorCode(err) || null,

    reason:
      resolveUserFacingBankTransferMessage(err)
  };
}

function showBridgeCustomerRejectedStatus(customer = {}) {
  setActiveStep(
    "customer"
  );

  markStepFailed(
    "customer"
  );

  setStatus({
    kind:
      "error",

    message:
      resolveUserFacingBridgeCustomerMessage(customer)
  });
}

function showBankTransferCreateFailedStatus(err = {}) {
  setActiveStep(
    "instructions"
  );

  markStepFailed(
    "instructions"
  );

  setStatus({
    kind:
      "error",

    message:
      resolveUserFacingBankTransferMessage(err)
  });
}

function markTosAccepted({
  persist
} = {}) {
  persist({
    tos_pending:
      false,

    tos_returned:
      false,

    tos_accepted:
      true,

    bridge_tos_status:
      "accepted"
  });

  markStepDone(
    "tos"
  );
}

function markTosRequired({
  persist,
  tosStatus
} = {}) {
  persist({
    tos_pending:
      false,

    tos_accepted:
      false,

    bridge_tos_status:
      normalizeString(tosStatus) ||
      "required"
  });
}

function markTosReturnedForCheck({
  persist
} = {}) {
  persist({
    tos_pending:
      false,

    tos_returned:
      true,

    tos_accepted:
      false,

    bridge_tos_status:
      "checking"
  });
}

function buildTosRetryResult() {
  return {
    ok:
      false,

    retryable:
      true,

    step:
      "tos",

    error:
      "bridge_tos_not_accepted"
  };
}

function showTosRequiredStatus() {
  setActiveStep(
    "tos"
  );

  setStatus({
    kind:
      "warning",

    message:
      "Bridge terms must be accepted before creating the funding profile. Please retry to continue terms acceptance."
  });
}

async function runTos({
  settlementId,
  state,
  query,
  persist
}) {
  if (
    shouldSkipTos({
      state
    })
  ) {
    markTosAccepted({
      persist
    });

    return {
      skipped:
        true
    };
  }

  setActiveStep(
    "tos"
  );

  /*
    Important:
    tos_accepted=1 in the URL only means the user returned
    from the Bridge ToS page. It is not proof that Bridge
    accepted the terms for this settlement/customer context.
  */
  if (isReturnedFromBridgeTos(query)) {
    markTosReturnedForCheck({
      persist
    });
  }

  const tos =
    await createBridgeTos({
      settlement_id:
        settlementId
    });

  const tosStatus =
    resolveTosStatus(
      tos
    );

  if (
    isAcceptedTosStatus(
      tosStatus
    )
  ) {
    markTosAccepted({
      persist
    });

    return {
      ok:
        true,

      accepted:
        true
    };
  }

  const tosUrl =
    resolveTosUrl(
      tos
    );

  if (tosUrl) {
    persist({
      tos_pending:
        true,

      tos_returned:
        false,

      tos_accepted:
        false,

      bridge_tos_status:
        tosStatus || "pending",

      tos_url:
        tosUrl
    });

    setStatus({
      kind:
        "warning",

      message:
        "Redirecting to accept Bridge terms…"
    });

    if (!openExternal(tosUrl)) {
      throw new Error(
        "missing_tos_redirect_url"
      );
    }

    return {
      redirected:
        true,

      step:
        "tos"
    };
  }

  markTosRequired({
    persist,
    tosStatus
  });

  return buildTosRetryResult();
}

async function runBridgeCustomer({
  settlementId,
  persist,
  instructionsBox
}) {
  setActiveStep(
    "customer"
  );

  const customerProfile =
    requireCustomerProfile();

  try {
    const customer =
      await createBridgeCustomer({
        settlement_id:
          settlementId,

        customer:
          customerProfile
      });

    const bridgeCustomerId =
      resolveBridgeCustomerId(
        customer
      );

    const bridgeCustomerStatus =
      resolveBridgeCustomerStatus(
        customer
      );

    const bridgeCustomerKycStatus =
      resolveBridgeCustomerKycStatus(
        customer
      );

    const bridgeCustomerTosStatus =
      resolveBridgeCustomerTosStatus(
        customer
      );

    const rejectionReasons =
      resolveRejectionReasons(
        customer
      );

    const issues =
      resolveIssues(
        customer
      );

    persist({
      bridge_customer_id:
        bridgeCustomerId,

      bridge_customer_status:
        bridgeCustomerStatus || null,

      bridge_customer_kyc_status:
        bridgeCustomerKycStatus || null,

      bridge_customer_tos_status:
        bridgeCustomerTosStatus || null,

      bridge_customer_rejection_reasons:
        rejectionReasons,

      bridge_customer_issues:
        issues,

      bridge_customer_rejection_reasons_json:
        stringifySafe(
          rejectionReasons
        ),

      bridge_customer_issues_json:
        stringifySafe(
          issues
        )
    });

    if (
      isRejectedBridgeCustomer(
        customer
      )
    ) {
      clearInstructionsBox(
        instructionsBox
      );

      showBridgeCustomerRejectedStatus(
        customer
      );

      return buildBridgeCustomerRejectedResult(
        customer
      );
    }

    markStepDone(
      "customer"
    );

    return {
      ok:
        true,

      customer
    };
  } catch (err) {
    if (
      isBridgeTosNotAcceptedError(
        err
      )
    ) {
      markTosRequired({
        persist,
        tosStatus:
          "required"
      });
    }

    if (
      isBridgeCustomerRejectedError(
        err
      )
    ) {
      const customer =
        resolveCustomerFromError(
          err
        );

      const rejectionReasons =
        resolveRejectionReasons(
          customer
        );

      const issues =
        resolveIssues(
          customer
        );

      clearInstructionsBox(
        instructionsBox
      );

      persist({
        bridge_customer_id:
          resolveBridgeCustomerId(
            customer
          ),

        bridge_customer_status:
          resolveBridgeCustomerStatus(
            customer
          ) || "rejected",

        bridge_customer_kyc_status:
          resolveBridgeCustomerKycStatus(
            customer
          ) || null,

        bridge_customer_tos_status:
          resolveBridgeCustomerTosStatus(
            customer
          ) || null,

        bridge_customer_rejection_reasons:
          rejectionReasons,

        bridge_customer_issues:
          issues,

        bridge_customer_rejection_reasons_json:
          stringifySafe(
            rejectionReasons
          ),

        bridge_customer_issues_json:
          stringifySafe(
            issues
          ),

        bridge_customer_error:
          resolveReadableErrorMessage(
            err
          )
      });

      showBridgeCustomerRejectedStatus(
        customer
      );

      return buildBridgeCustomerRejectedResult(
        customer
      );
    }

    throw err;
  }
}

async function runBridgeBankTransfer({
  settlementId,
  state,
  persist,
  instructionsBox
}) {
  setActiveStep(
    "instructions"
  );

  try {
    const funding =
      await createBridgeBankTransfer({
        settlement_id:
          settlementId,

        source_country:
          state.source_country,

        source_rail:
          state.source_rail
      });

    persist({
      bridge_transfer_id:
        funding.bridge_transfer_id,

      bridge_transfer_state:
        funding.bridge_transfer_state,

      latest_funding_response:
        funding,

      bridge_bank_transfer_error:
        null
    });

    renderBankInstructions(
      instructionsBox,
      funding
    );

    markStepDone(
      "instructions"
    );

    showWaitingForFunding();

    return {
      ok:
        true,

      funding
    };
  } catch (err) {
    clearInstructionsBox(
      instructionsBox
    );

    persist({
      bridge_bank_transfer_error:
        resolveReadableErrorMessage(
          err
        ),

      bridge_bank_transfer_error_status:
        resolveErrorStatus(
          err
        ) || null,

      bridge_bank_transfer_error_code:
        resolveErrorCode(
          err
        ) || null
    });

    showBankTransferCreateFailedStatus(
      err
    );

    return buildBankTransferCreateFailedResult(
      err
    );
  }
}

export async function runBankFundingSteps({
  settlementId,
  state,
  query,
  persist,
  instructionsBox,
  onConfirm
}) {
  setActiveStep(
    "kyc"
  );

  const kycResult =
    await runKyc({
      settlementId,
      state,
      persist,
      onConfirm
    });

  if (kycResult.redirected) {
    return {
      redirected:
        true,

      step:
        "kyc"
    };
  }

  const tosResult =
    await runTos({
      settlementId,
      state,
      query,
      persist
    });

  if (tosResult.redirected) {
    return {
      redirected:
        true,

      step:
        "tos"
    };
  }

  if (tosResult.retryable) {
    showTosRequiredStatus();

    return tosResult;
  }

  const customerResult =
    await runBridgeCustomer({
      settlementId,
      persist,
      instructionsBox
    });

  if (
    customerResult?.blocked ||
    customerResult?.retryable ||
    customerResult?.ok === false
  ) {
    clearInstructionsBox(
      instructionsBox
    );

    return customerResult;
  }

  const fundingResult =
    await runBridgeBankTransfer({
      settlementId,
      state,
      persist,
      instructionsBox
    });

  if (
    fundingResult?.blocked ||
    fundingResult?.retryable ||
    fundingResult?.ok === false
  ) {
    clearInstructionsBox(
      instructionsBox
    );

    return fundingResult;
  }

  return {
    ok:
      true,

    funding:
      fundingResult.funding
  };
}
