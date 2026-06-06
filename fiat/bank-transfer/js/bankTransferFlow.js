// fiat/bank-transfer/js/bankTransferFlow.js

import {
  createBridgeTos,
  createBridgeCustomer,
  createBridgeBankTransfer
} from "./api.js";

import {
  getDefaultSourceRail
} from "./config.js";

import {
  createSettlementFromPreparedQuote,
  loadBankTransferRoutes,
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
  ensureFiatClerkAuth
} from "./clerkAuth.js";

import {
  prepareCustomerProfileForm,
  ensureCustomerProfileFromForm,
  requireCustomerProfile,
  focusCustomerProfileField
} from "./customerProfile.js";

import {
  resetStaleSettlementAttemptIfNeeded
} from "./settlementResume.js";

import {
  runKyc,
  clearDiditAutoContinue
} from "./kycFlow.js";

import {
  setStatus,
  setActiveStep,
  markStepDone,
  markStepFailed,
  setPrimaryAction,
  showWaitingForFunding
} from "./status.js";

const FIAT_CONTEXT_KEY =
  "unibridge_fiat_context";

const query =
  readQueryParams();

const state =
  resolveInitialState(
    getDefaultSourceRail()
  );

let preparedQuote =
  state.settlement_id
    ? state.prepared_quote || null
    : null;

let autoResumeStarted =
  false;

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

function resolveErrorMessage(error) {
  if (!error) {
    return "Unexpected error";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error.message) {
    return error.message;
  }

  if (error.error?.message) {
    return error.error.message;
  }

  if (error.error) {
    return normalizeString(error.error);
  }

  if (error.code) {
    return error.code;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unexpected error";
  }
}

function hasFiatContext() {
  return Boolean(
    window.localStorage.getItem(
      FIAT_CONTEXT_KEY
    )
  );
}

function isReturnedFromBridgeTos() {
  return (
    query.tos_accepted === "1" ||
    query.tos_accepted === "true"
  );
}

function goToPayEntry() {
  window.location.href =
    "/pay";
}

function setQuoteButton({
  label,
  disabled
} = {}) {
  if (!quoteButton) {
    return;
  }

  if (label) {
    quoteButton.textContent =
      label;
  }

  quoteButton.disabled =
    Boolean(disabled);
}

function setCreateSettlementButton({
  label,
  disabled
} = {}) {
  if (!createSettlementButton) {
    return;
  }

  if (label) {
    createSettlementButton.textContent =
      label;
  }

  createSettlementButton.disabled =
    Boolean(disabled);
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
    isReturnedFromBridgeTos()
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

function handleCustomerProfileError(err) {
  if (!err?.field) {
    return false;
  }

  showEntryMode();

  prepareCustomerProfileForm();

  focusCustomerProfileField(
    err.field
  );

  setStatus({
    kind:
      "failed",

    message:
      resolveErrorMessage(err)
  });

  return true;
}

function resetStaleSettlementAttempt() {
  const result =
    resetStaleSettlementAttemptIfNeeded({
      state,
      query,

      hasFiatContext:
        hasFiatContext(),

      defaultSourceRail:
        getDefaultSourceRail()
    });

  if (!result.reset) {
    return;
  }

  preparedQuote =
    null;

  autoResumeStarted =
    false;

  writeStoredState(
    state
  );
}

function scheduleAutoResumeAfterTosReturn() {
  if (autoResumeStarted) {
    return;
  }

  autoResumeStarted =
    true;

  setStatus({
    kind:
      "warning",

    message:
      "Terms accepted. Continuing bank transfer setup…"
  });

  setPrimaryAction({
    label:
      "Processing…",

    disabled:
      true
  });

  window.setTimeout(
    () => {
      runBankTransferFlow();
    },
    500
  );
}

async function runTos({
  settlementId
}) {
  if (shouldSkipTos()) {
    persist({
      tos_pending:
        false,

      tos_accepted:
        true,

      bridge_tos_status:
        "accepted"
    });

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

    if (!openExternal(tosUrl)) {
      throw new Error(
        "missing_tos_redirect_url"
      );
    }

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

  const customerProfile =
    requireCustomerProfile();

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

    setActiveStep(
      "kyc"
    );

    await ensureFiatClerkAuth();

    const kycResult =
      await runKyc({
        settlementId,
        state,
        persist,

        onConfirm:
          runBankTransferFlow
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
    clearDiditAutoContinue();

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

    if (handleCustomerProfileError(err)) {
      setPrimaryAction({
        label:
          "Retry",

        disabled:
          false
      });

      return;
    }

    setStatus({
      kind:
        "failed",

      message:
        resolveErrorMessage(err) ||
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

async function handleQuote() {
  if (!hasFiatContext()) {
    goToPayEntry();
    return;
  }

  try {
    setQuoteButton({
      label:
        "Getting quote…",

      disabled:
        true
    });

    setCreateSettlementButton({
      label:
        "Create payout route",

      disabled:
        true
    });

    await ensureFiatClerkAuth();

    prepareCustomerProfileForm();

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

    setCreateSettlementButton({
      label:
        "Create payout route",

      disabled:
        false
    });

    setQuoteButton({
      label:
        "Quote ready",

      disabled:
        true
    });
  } catch (err) {
    preparedQuote =
      null;

    console.error(
      "BANK_TRANSFER_QUOTE_FAILED",
      err
    );

    alert(
      resolveErrorMessage(err) ||
      "Could not prepare quote"
    );

    setQuoteButton({
      label:
        hasFiatContext()
          ? "Get quote"
          : "Start from Pay with UniBridge",

      disabled:
        false
    });

    setCreateSettlementButton({
      label:
        "Create payout route",

      disabled:
        true
    });
  }
}

async function handleCreateSettlement() {
  try {
    if (!preparedQuote) {
      throw new Error(
        "missing_prepared_quote"
      );
    }

    setCreateSettlementButton({
      label:
        "Creating route…",

      disabled:
        true
    });

    await ensureFiatClerkAuth();

    ensureCustomerProfileFromForm();

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
    clearDiditAutoContinue();

    console.error(
      "BANK_TRANSFER_CREATE_SETTLEMENT_FAILED",
      err
    );

    if (handleCustomerProfileError(err)) {
      setCreateSettlementButton({
        label:
          "Create payout route",

        disabled:
          false
      });

      return;
    }

    alert(
      resolveErrorMessage(err) ||
      "Could not create payout route"
    );

    setCreateSettlementButton({
      label:
        "Create payout route",

      disabled:
        false
    });
  }
}

function initResumeState() {
  if (isReturnedFromBridgeTos()) {
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

  if (state.settlement_id) {
    if (isReturnedFromBridgeTos()) {
      scheduleAutoResumeAfterTosReturn();
      return;
    }

    setStatus({
      message:
        "Ready to create bank transfer funding."
    });
  }
}

async function initEntryRoutes() {
  if (state.settlement_id) {
    return;
  }

  setQuoteButton({
    label:
      "Preparing…",

    disabled:
      true
  });

  setCreateSettlementButton({
    label:
      "Create payout route",

    disabled:
      true
  });

  try {
    await loadBankTransferRoutes();

    if (hasFiatContext()) {
      await ensureFiatClerkAuth();

      prepareCustomerProfileForm();
    }

    setQuoteButton({
      label:
        hasFiatContext()
          ? "Get quote"
          : "Start from Pay with UniBridge",

      disabled:
        false
    });
  } catch (err) {
    console.error(
      "BANK_TRANSFER_CONTEXT_LOAD_FAILED",
      err
    );

    setQuoteButton({
      label:
        "Start from Pay with UniBridge",

      disabled:
        false
    });
  }
}

function init() {
  resetStaleSettlementAttempt();

  initResumeState();

  initEntryRoutes();

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
