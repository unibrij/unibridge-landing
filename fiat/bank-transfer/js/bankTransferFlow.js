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
  createSettlementFromPreparedQuote,
  prepareBankTransferSettlement,
  renderQuote
} from "./entryForm.js";

import {
  readQueryParams,
  resolveInitialState,
  writeStoredState,
  writeBankCustomerRef
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

let preparedQuote =
  state.prepared_quote || null;

const entryBox =
  document.getElementById("entryBox");

const fundingBox =
  document.getElementById("fundingBox");

const quoteBox =
  document.getElementById("quoteBox");

const quoteButton =
  document.getElementById("quoteAction");

const createSettlementButton =
  document.getElementById("createSettlementAction");

const primaryButton =
  document.getElementById("primaryAction");

const refreshButton =
  document.getElementById("refreshStatus");

const instructionsBox =
  document.getElementById("instructionsBox");

function normalizeString(value) {
  return String(value || "").trim();
}

function requireSettlementId() {
  if (!state.settlement_id) {
    throw new Error("missing_settlement_id");
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

  if (values.bank_customer_ref) {
    writeBankCustomerRef(
      values.bank_customer_ref
    );
  }
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

function showEntryMode() {
  entryBox?.classList.remove("hidden");
  fundingBox?.classList.add("hidden");
}

function showFundingMode() {
  entryBox?.classList.add("hidden");
  fundingBox?.classList.remove("hidden");
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

  showFundingMode();

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

      bank_customer_ref:
        state.bank_customer_ref,

      bank_verified_identity_ref:
        state.bank_verified_identity_ref || null,

      source_country:
        state.source_country,

      source_rail:
        state.source_rail
    });

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
      state.bank_customer_ref,

    bank_verified_identity_ref:
      kyc.bank_verified_identity_ref ||
      state.bank_verified_identity_ref ||
      null
  });

  if (
    kyc.reused ||
    kyc.status === "passed"
  ) {
    markStepDone("kyc");
    return kyc;
  }

  const kycUrl =
    kyc.url ||
    kyc.provider_url ||
    kyc.provider_reference;

  if (kycUrl) {
    setStatus({
      kind: "warning",
      message:
        "Redirecting to complete identity verification…"
    });

    if (!openExternal(kycUrl)) {
      throw new Error("missing_kyc_redirect_url");
    }

    return {
      ...kyc,
      redirected: true
    };
  }

  throw new Error(
    kyc.status
      ? `kyc_not_ready_${kyc.status}`
      : "kyc_not_ready"
  );
}

async function runTos({
  settlementId
}) {
  if (shouldSkipTos()) {
    markStepDone(
      "tos"
    );

    return {
      skipped: true
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
      kind: "warning",
      message:
        "Redirecting to accept Bridge terms…"
    });

    if (!openExternal(tosUrl)) {
      throw new Error("missing_tos_redirect_url");
    }

    return {
      redirected: true
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
    ok: true
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
    showFundingMode();

    setPrimaryAction({
      label: "Processing…",
      disabled: true
    });

    const settlementId =
      requireSettlementId();

    if (
      hasExistingInstructions() &&
      restoreExistingInstructions()
    ) {
      return;
    }

    const kycResult =
      await runKyc({
        settlementId
      });

    if (kycResult.redirected) {
      return;
    }

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
      document.querySelector(".step.active");

    if (active?.dataset?.step) {
      markStepFailed(
        active.dataset.step
      );
    }

    setStatus({
      kind: "failed",
      message:
        err.message ||
        "Bank transfer setup failed"
    });

    setPrimaryAction({
      label: "Retry",
      disabled: false
    });
  }
}

async function handleQuote() {
  try {
    quoteButton.disabled =
      true;

    quoteButton.textContent =
      "Getting quote…";

    preparedQuote =
      await prepareBankTransferSettlement();

    persist({
      prepared_quote:
        preparedQuote,

      source_country:
        preparedQuote.form?.source_country,

      source_rail:
        preparedQuote.form?.source_rail
    });

    renderQuote(
      quoteBox,
      {
        form:
          preparedQuote.form,
        quote:
          preparedQuote.quote,
        selectedRoute:
          preparedQuote.selected_route
      }
    );

    createSettlementButton.disabled =
      false;

    quoteButton.textContent =
      "Refresh quote";
  } catch (err) {
    console.error(
      "BANK_TRANSFER_QUOTE_FAILED",
      err
    );

    alert(
      err.message ||
      "Could not prepare quote"
    );

    quoteButton.textContent =
      "Get quote";
  } finally {
    quoteButton.disabled =
      false;
  }
}

async function handleCreateSettlement() {
  try {
    if (!preparedQuote) {
      throw new Error(
        "missing_prepared_quote"
      );
    }

    createSettlementButton.disabled =
      true;

    createSettlementButton.textContent =
      "Creating route…";

    const created =
      await createSettlementFromPreparedQuote(
        preparedQuote
      );

    persist({
      settlement_id:
        created.settlement_id,

      settlement:
        created.settlement,

      source_country:
        created.source_country,

      source_rail:
        created.source_rail
    });

    showFundingMode();

    setStatus({
      message:
        "Payout route created. Ready to set up bank transfer funding."
    });

    await runBankTransferFlow();
  } catch (err) {
    console.error(
      "BANK_TRANSFER_CREATE_SETTLEMENT_FAILED",
      err
    );

    alert(
      err.message ||
      "Could not create payout route"
    );

    createSettlementButton.disabled =
      false;

    createSettlementButton.textContent =
      "Create payout route";
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

  if (query.bank_verified_identity_ref) {
    persist({
      bank_verified_identity_ref:
        query.bank_verified_identity_ref
    });
  }

  if (state.settlement_id) {
    showFundingMode();
  } else {
    showEntryMode();
  }

  if (hasExistingInstructions()) {
    restoreExistingInstructions();
    return;
  }

  if (state.tos_pending) {
    showFundingMode();

    setStatus({
      kind: "warning",
      message:
        "Terms acceptance may be complete. Continue to generate bank transfer instructions."
    });

    setPrimaryAction({
      label: "Continue",
      disabled: false
    });

    return;
  }

  if (state.settlement_id) {
    setStatus({
      message:
        "Ready to create bank transfer funding."
    });
  }
}

function init() {
  initResumeState();

  quoteButton?.addEventListener(
    "click",
    handleQuote
  );

  createSettlementButton?.addEventListener(
    "click",
    handleCreateSettlement
  );

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
