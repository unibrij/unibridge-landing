// fiat/bank-transfer/js/bankTransferFlow.js

import {
  getDefaultSourceRail
} from "./config.js";

import {
  loadBankTransferRoutes
} from "./entryForm.js";

import {
  readQueryParams,
  resolveInitialState,
  writeStoredState,
  writeBankCustomerRef
} from "./state.js";

import {
  hideCustomerProfileForm
} from "./customerProfile.js";

import {
  setStatus
} from "./status.js";

import {
  resolveErrorMessage
} from "./flowErrors.js";

import {
  showEntryMode,
  setEntryButtonsForPreparing,
  setEntryButtonsForQuoteIdle,
  resetEntryButtonsAfterAuthReset,
  attachBankTransferEvents
} from "./flowUi.js";

import {
  syncAuthOwnerOrReset
} from "./flowAuthOwner.js";

import {
  resetStaleSettlementAttempt,
  initResumeState
} from "./flowResume.js";

import {
  createBankTransferHandlers
} from "./flowHandlers.js";

const FIAT_CONTEXT_KEY =
  "unibridge_fiat_context";

const query =
  readQueryParams();

const state =
  resolveInitialState(
    getDefaultSourceRail()
  );

const runtime = {
  preparedQuote:
    state.settlement_id
      ? state.prepared_quote || null
      : null,

  autoResumeStarted:
    false
};

const quoteBox =
  document.getElementById("quoteBox");

const instructionsBox =
  document.getElementById("instructionsBox");

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

function goToPayEntry() {
  window.location.href =
    "/pay";
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

async function initEntryRoutes() {
  hideCustomerProfileForm();

  if (state.settlement_id) {
    hideCustomerProfileForm();

    return;
  }

  setEntryButtonsForPreparing();

  try {
    await loadBankTransferRoutes();

    setEntryButtonsForQuoteIdle({
      hasFiatContext:
        hasFiatContext()
    });

    hideCustomerProfileForm();
  } catch (err) {
    hideCustomerProfileForm();

    console.error(
      "BANK_TRANSFER_CONTEXT_LOAD_FAILED",
      err
    );

    setEntryButtonsForQuoteIdle({
      hasFiatContext:
        false
    });
  }
}

async function syncInitialAuthBeforeResume({
  handlers
} = {}) {
  if (
    !hasFiatContext() &&
    !state.settlement_id
  ) {
    return {
      reset:
        false
    };
  }

  return syncAuthOwnerOrReset({
    state,
    query
  });
}

async function init() {
  resetStaleSettlementAttempt({
    state,
    query,
    readFiatContext,
    runtime
  });

  hideCustomerProfileForm();

  const handlers =
    createBankTransferHandlers({
      state,
      query,
      runtime,
      quoteBox,
      instructionsBox,
      persist,
      hasFiatContext,
      goToPayEntry,
      readFiatContextStartedAt,

      syncAuthOwnerOrReset:
        ({ resetUi } = {}) => {
          return syncAuthOwnerOrReset({
            state,
            query,
            resetUi
          });
        },

      showEntryMode
    });

  attachBankTransferEvents({
    handleQuote:
      handlers.handleQuote,

    handleCreateSettlement:
      handlers.handleCreateSettlement,

    runBankTransferFlow:
      handlers.runBankTransferFlow
  });

  try {
    const authSync =
      await syncInitialAuthBeforeResume({
        handlers
      });

    if (authSync?.reset) {
      runtime.preparedQuote =
        null;

      runtime.autoResumeStarted =
        false;

      hideCustomerProfileForm();

      showEntryMode();

      resetEntryButtonsAfterAuthReset({
        hasFiatContext:
          hasFiatContext()
      });

      await initEntryRoutes();

      return;
    }
  } catch (err) {
    console.error(
      "BANK_TRANSFER_INITIAL_AUTH_SYNC_FAILED",
      err
    );

    hideCustomerProfileForm();

    showEntryMode();

    resetEntryButtonsAfterAuthReset({
      hasFiatContext:
        hasFiatContext()
    });

    setStatus({
      kind:
        "failed",

      message:
        resolveErrorMessage(err) ||
        "Could not verify the signed-in account."
    });

    return;
  }

  initResumeState({
    state,
    query,
    persist,
    runtime,
    instructionsBox,

    runBankTransferFlow:
      handlers.runBankTransferFlow
  });

  await initEntryRoutes();
}

init();
