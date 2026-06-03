// fiat/bank-transfer/js/bankTransferFlow.js

import {
  createFiatKyc,
  createBridgeTos,
  createBridgeCustomer,
  createBridgeBankTransfer
} from "./api.js";

import {
  getDefaultSourceRail
} from "./config.js";

import {
  readQueryParams,
  resolveInitialState,
  writeStoredState
} from "./state.js";

import {
  renderBankInstructions
} from "./instructions.js";

import {
  setStatus,
  setActiveStep,
  markStepDone,
  markStepFailed,
  setPrimaryAction,
  showWaitingForFunding
} from "./status.js";

const query =
  readQueryParams();

const state =
  resolveInitialState(
    getDefaultSourceRail()
  );

const primaryButton =
  document.getElementById(
    "primaryAction"
  );

const refreshButton =
  document.getElementById(
    "refreshStatus"
  );

const instructionsBox =
  document.getElementById(
    "instructionsBox"
  );

function normalizeString(value) {
  return String(value || "").trim();
}

function requireSettlementId() {
  if (!state.settlement_id) {
    throw new Error(
      "missing_settlement_id"
    );
  }

  return state.settlement_id;
}

function persist(values = {}) {
  Object.assign(
    state,
    values
  );

  writeStoredState(
    state
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

function hasExistingInstructions() {
  return Boolean(
    state.bridge_transfer_id &&
    state.bridge_transfer_state
  );
}

function shouldSkipTos() {
  return Boolean(
    state.tos_accepted ||
    state.bridge_tos_status === "accepted" ||
    query.tos_accepted === "1" ||
    query.tos_accepted === "true"
  );
}

function restoreExistingInstructions() {
  if (!state.latest_funding_response) {
    return false;
  }

  renderBankInstructions(
    instructionsBox,
    state.latest_funding_response
  );

  showWaitingForFunding();

  return true;
}

async function runKyc({
  settlementId
}) {
  setActiveStep(
    "kyc"
  );

  const kyc =
    await createFiatKyc({
      settlement_id:
        settlementId,

      email:
        state.email,

      phone:
        state.phone,

      source_country:
        state.source_country,

      source_rail:
        state.source_rail
    });

  persist({
    kyc_status:
      kyc.status,
    kyc_session_id:
      kyc.session_id
  });

  markStepDone(
    "kyc"
  );

  return kyc;
}

async function runTos({
  settlementId
}) {
  if (shouldSkipTos()) {
    markStepDone(
      "tos"
    );

    return {
      skipped:
        true
    };
  }

  setActiveStep(
    "tos"
  );

  const tos =
    await createBridgeTos({
      settlement_id:
        settlementId
    });

  const tosUrl =
    tos.url ||
    tos.tos_url ||
    tos.link;

  if (tosUrl) {
    persist({
      tos_pending:
        true,
      tos_url:
        tosUrl
    });

    setStatus({
      kind:
        "warning",
      message:
        "Redirecting to accept Bridge terms…"
    });

    openExternal(
      tosUrl
    );

    return {
      redirected:
        true
    };
  }

  persist({
    tos_accepted:
      true,
    bridge_tos_status:
      "accepted"
  });

  markStepDone(
    "tos"
  );

  return {
    ok:
      true
  };
}

async function runBridgeCustomer({
  settlementId
}) {
  setActiveStep(
    "customer"
  );

  const customer =
    await createBridgeCustomer({
      settlement_id:
        settlementId
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
}

async function runBridgeBankTransfer({
  settlementId
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

async function runBankTransferFlow() {
  try {
    setPrimaryAction({
      label:
        "Processing…",
      disabled:
        true
    });

    const settlementId =
      requireSettlementId();

    if (
      hasExistingInstructions() &&
      restoreExistingInstructions()
    ) {
      return;
    }

    await runKyc({
      settlementId
    });

    const tosResult =
      await runTos({
        settlementId
      });

    if (tosResult.redirected) {
      return;
    }

    await runBridgeCustomer({
      settlementId
    });

    await runBridgeBankTransfer({
      settlementId
    });
  } catch (err) {
    console.error(
      "BANK_TRANSFER_FLOW_FAILED",
      err
    );

    const active =
      document.querySelector(
        ".step.active"
      );

    if (active?.dataset?.step) {
      markStepFailed(
        active.dataset.step
      );
    }

    setStatus({
      kind:
        "failed",
      message:
        err.message ||
        "Bank transfer setup failed"
    });

    setPrimaryAction({
      label:
        "Retry",
      disabled:
        false
    });
  }
}

function initResumeState() {
  if (
    query.tos_accepted === "1" ||
    query.tos_accepted === "true"
  ) {
    persist({
      tos_pending:
        false,
      tos_accepted:
        true,
      bridge_tos_status:
        "accepted"
    });
  }

  if (hasExistingInstructions()) {
    restoreExistingInstructions();

    return;
  }

  if (state.tos_pending) {
    setStatus({
      kind:
        "warning",
      message:
        "Terms acceptance may be complete. Continue to generate bank transfer instructions."
    });

    setPrimaryAction({
      label:
        "Continue",
      disabled:
        false
    });

    return;
  }

  setStatus({
    message:
      "Ready to create bank transfer funding."
  });
}

function init() {
  initResumeState();

  primaryButton?.addEventListener(
    "click",
    runBankTransferFlow
  );

  refreshButton?.addEventListener(
    "click",
    () => {
      window.location.reload();
    }
  );
}

init();
