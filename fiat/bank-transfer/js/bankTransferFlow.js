// fiat/bank-transfer/js/bankTransferFlow.js

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
  replaceStoredState,
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
  focusCustomerProfileField,
  hideCustomerProfileForm
} from "./customerProfile.js";

import {
  resetStaleSettlementAttemptIfNeeded
} from "./settlementResume.js";

import {
  runBankFundingSteps
} from "./bankFundingSteps.js";

import {
  clearDiditAutoContinue
} from "./kycFlow.js";

import {
  setStatus,
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

function readFiatContext() {
  return window.localStorage.getItem(
    FIAT_CONTEXT_KEY
  );
}

function readFiatContextObject() {
  const raw =
    readFiatContext();

  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function readFiatContextStartedAt() {
  const context =
    readFiatContextObject();

  return (
    context.flow_started_at ||
    context.started_at ||
    context.created_at ||
    context.updated_at ||
    null
  );
}

function hasFiatContext() {
  return Boolean(
    readFiatContext()
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

      fiatContext:
        readFiatContext(),

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

  replaceStoredState(
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

    await ensureFiatClerkAuth();

    const stepsResult =
      await runBankFundingSteps({
        settlementId,
        state,
        query,
        persist,
        instructionsBox,

        onConfirm:
          runBankTransferFlow
      });

    if (stepsResult?.redirected) {
      return;
    }
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

    prepareCustomerProfileForm();

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

    hideCustomerProfileForm();

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
        created.source_rail,

      fiat_context_started_at:
        readFiatContextStartedAt()
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

    if (err?.handled === true) {
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

  hideCustomerProfileForm();

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
    hideCustomerProfileForm();

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
