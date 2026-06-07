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
  showWaitingForFunding
} from "./status.js";

function normalizeString(value) {
  return String(value || "").trim();
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
  persist
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

    persist({
      bridge_customer_id:
        customer.bridge_customer_id,

      bridge_customer_status:
        customer.status || null,

      bridge_customer_kyc_status:
        customer.kyc_status || null,

      bridge_customer_tos_status:
        customer.tos_status || null
    });

    markStepDone(
      "customer"
    );

    return customer;
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
      funding
  });

  renderBankInstructions(
    instructionsBox,
    funding
  );

  markStepDone(
    "instructions"
  );

  showWaitingForFunding();

  return funding;
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

  try {
    await runBridgeCustomer({
      settlementId,
      persist
    });
  } catch (err) {
    if (
      isBridgeTosNotAcceptedError(
        err
      )
    ) {
      showTosRequiredStatus();

      return buildTosRetryResult();
    }

    throw err;
  }

  const funding =
    await runBridgeBankTransfer({
      settlementId,
      state,
      persist,
      instructionsBox
    });

  return {
    ok:
      true,

    funding
  };
}
