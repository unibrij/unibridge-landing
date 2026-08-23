// fiat/bank-transfer/js/bankTransferFlow.js

import {
  getDefaultSourceRail
} from "./config.js";

import {
  loadBankTransferRoutes
} from "./entryForm.js";

import {
  invalidatePreparedQuote
} from "./entryState.js";

import {
  readQueryParams,
  resolveInitialState,
  writeStoredState,
  writeBankCustomerRef,
  clearStoredState
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

import {
  isRepeatPayoutView,
  loadRepeatPayoutSource,
  applyRepeatEntryPrefill,
  applyRepeatRoutePrefill
} from "./repeatPayout.js";


const FIAT_CONTEXT_KEY =
  "unibridge_fiat_context";


/*
--------------------------------------------------
View
--------------------------------------------------
*/

function isHistoryView() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  return (
    params.get(
      "view"
    ) ===
    "history"
  );
}


/*
--------------------------------------------------
State
--------------------------------------------------
*/

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
    false,

  repeatSource:
    null
};


const quoteBox =
  document.getElementById(
    "quoteBox"
  );

const instructionsBox =
  document.getElementById(
    "instructionsBox"
  );


/*
--------------------------------------------------
Fiat context
--------------------------------------------------
*/

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
    return JSON.parse(
      raw
    ) || {};
  }
  catch {
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


/*
--------------------------------------------------
Entry context
--------------------------------------------------

Normal flow requires the Pay-created fiat context.

Repeat flow is allowed to rebuild that context from
the visible entry form. The user may therefore choose
a source country before requesting the new quote.
--------------------------------------------------
*/

function hasEntryContext() {
  return (
    hasFiatContext() ||
    isRepeatPayoutView()
  );
}


/*
--------------------------------------------------
Navigation
--------------------------------------------------
*/

function goToPayEntry() {
  window.location.href =
    "/pay";
}


function startNewTransfer() {
  clearStoredState();

  window.localStorage.removeItem(
    FIAT_CONTEXT_KEY
  );

  invalidatePreparedQuote();

  goToPayEntry();
}


/*
--------------------------------------------------
Persistence
--------------------------------------------------
*/

function persist(values = {}) {
  Object.assign(
    state,
    values
  );

  writeStoredState(
    state
  );

  if (
    values.bank_customer_ref
  ) {
    writeBankCustomerRef(
      values.bank_customer_ref
    );
  }
}


/*
--------------------------------------------------
Entry routes
--------------------------------------------------
*/

async function initEntryRoutes() {
  hideCustomerProfileForm();

  if (
    state.settlement_id
  ) {
    hideCustomerProfileForm();

    return;
  }

  setEntryButtonsForPreparing();

  try {
    await loadBankTransferRoutes();

    setEntryButtonsForQuoteIdle({
      hasFiatContext:
        hasEntryContext()
    });

    hideCustomerProfileForm();
  }
  catch (err) {
    hideCustomerProfileForm();

    console.error(
      "BANK_TRANSFER_CONTEXT_LOAD_FAILED",
      err
    );

    setEntryButtonsForQuoteIdle({
      hasFiatContext:
        hasEntryContext()
    });
  }
}


/*
--------------------------------------------------
Initial auth
--------------------------------------------------
*/

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


/*
--------------------------------------------------
Repeat payout
--------------------------------------------------
*/

async function initRepeatPayout() {
  if (
    !isRepeatPayoutView()
  ) {
    return;
  }

  const source =
    await loadRepeatPayoutSource();

  if (!source) {
    return;
  }

  runtime.repeatSource =
    source;

  applyRepeatEntryPrefill(
    source
  );
}


function createQuoteHandler(
  handleQuote
) {
  return async function handleQuoteWithRepeat() {
    await handleQuote();

    if (
      runtime.repeatSource
    ) {
      applyRepeatRoutePrefill(
        runtime.repeatSource
      );
    }
  };
}


/*
--------------------------------------------------
Init
--------------------------------------------------
*/

async function init() {
  if (
    isHistoryView()
  ) {
    return;
  }

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

      hasFiatContext:
        hasEntryContext,

      goToPayEntry,
      readFiatContextStartedAt,

      syncAuthOwnerOrReset:
        ({
          resetUi
        } = {}) => {
          return syncAuthOwnerOrReset({
            state,
            query,
            resetUi
          });
        },

      showEntryMode
    });


  const handleQuote =
    createQuoteHandler(
      handlers.handleQuote
    );


  attachBankTransferEvents({
    handleQuote,

    handleCreateSettlement:
      handlers.handleCreateSettlement,

    runBankTransferFlow:
      handlers.runBankTransferFlow,

    startNewTransfer,

    handleEntryChanged:
      () => {
        invalidatePreparedQuote();

        runtime.preparedQuote =
          null;

        persist({
          prepared_quote:
            null
        });
      },

    hasFiatContext:
      hasEntryContext
  });


  try {
    const authSync =
      await syncInitialAuthBeforeResume({
        handlers
      });

    if (
      authSync?.reset
    ) {
      invalidatePreparedQuote();

      runtime.preparedQuote =
        null;

      runtime.autoResumeStarted =
        false;

      hideCustomerProfileForm();

      showEntryMode();

      resetEntryButtonsAfterAuthReset({
        hasFiatContext:
          hasEntryContext()
      });

      await initEntryRoutes();

      return;
    }
  }
  catch (err) {
    console.error(
      "BANK_TRANSFER_INITIAL_AUTH_SYNC_FAILED",
      err
    );

    hideCustomerProfileForm();

    showEntryMode();

    resetEntryButtonsAfterAuthReset({
      hasFiatContext:
        hasEntryContext()
    });

    setStatus({
      kind:
        "failed",

      message:
        resolveErrorMessage(
          err
        ) ||
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


  try {
    await initRepeatPayout();

    if (
      runtime.repeatSource &&
      hasFiatContext()
    ) {
      await handleQuote();
    }
  }
  catch (err) {
    console.error(
      "BANK_TRANSFER_REPEAT_INIT_FAILED",
      err
    );

    setStatus({
      kind:
        "warning",

      message:
        resolveErrorMessage(
          err
        ) ||
        "Could not load the previous payout."
    });
  }
}


init();
