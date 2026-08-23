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

let initPromise =
  null;


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
    return (
      JSON.parse(
        raw
      ) || {}
    );
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
Initialization
--------------------------------------------------
*/

async function init() {
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

  if (
    !quoteBox ||
    !instructionsBox
  ) {
    throw new Error(
      "bank_transfer_flow_mount_missing"
    );
  }


  /*
  ------------------------------------------------
  Persistence
  ------------------------------------------------
  */

  function persist(
    values = {}
  ) {
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
  ------------------------------------------------
  Entry routes
  ------------------------------------------------
  */

  async function initEntryRoutes() {
    hideCustomerProfileForm();

    if (
      state.settlement_id
    ) {
      return;
    }

    setEntryButtonsForPreparing();

    try {
      await loadBankTransferRoutes();
    }
    catch (
      error
    ) {
      console.error(
        "BANK_TRANSFER_CONTEXT_LOAD_FAILED",
        error
      );
    }

    setEntryButtonsForQuoteIdle({
      hasFiatContext:
        hasEntryContext()
    });

    hideCustomerProfileForm();
  }


  /*
  ------------------------------------------------
  Repeat payout
  ------------------------------------------------
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


  /*
  ------------------------------------------------
  State recovery
  ------------------------------------------------
  */

  resetStaleSettlementAttempt({
    state,
    query,
    readFiatContext,
    runtime
  });

  hideCustomerProfileForm();


  /*
  ------------------------------------------------
  Handlers
  ------------------------------------------------
  */

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
    async () => {
      await handlers.handleQuote();

      if (
        runtime.repeatSource
      ) {
        applyRepeatRoutePrefill(
          runtime.repeatSource
        );
      }
    };


  /*
  ------------------------------------------------
  Events
  ------------------------------------------------
  */

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


  /*
  ------------------------------------------------
  Auth
  ------------------------------------------------
  */

  if (
    hasFiatContext() ||
    state.settlement_id
  ) {
    try {
      const authSync =
        await syncAuthOwnerOrReset({
          state,
          query
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
    catch (
      error
    ) {
      console.error(
        "BANK_TRANSFER_INITIAL_AUTH_SYNC_FAILED",
        error
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
            error
          ) ||
          "Could not verify the signed-in account."
      });

      return;
    }
  }


  /*
  ------------------------------------------------
  Resume
  ------------------------------------------------
  */

  initResumeState({
    state,
    query,
    persist,
    runtime,
    instructionsBox,

    runBankTransferFlow:
      handlers.runBankTransferFlow
  });


  /*
  ------------------------------------------------
  Entry
  ------------------------------------------------
  */

  await initEntryRoutes();


  /*
  ------------------------------------------------
  Repeat
  ------------------------------------------------
  */

  try {
    await initRepeatPayout();

    if (
      runtime.repeatSource &&
      hasFiatContext()
    ) {
      await handleQuote();
    }
  }
  catch (
    error
  ) {
    console.error(
      "BANK_TRANSFER_REPEAT_INIT_FAILED",
      error
    );

    setStatus({
      kind:
        "warning",

      message:
        resolveErrorMessage(
          error
        ) ||
        "Could not load the previous payout."
    });
  }
}


/*
--------------------------------------------------
Public init
--------------------------------------------------
*/

export function initBankTransferFlow() {
  if (!initPromise) {
    initPromise =
      init()
        .catch(
          error => {
            initPromise =
              null;

            throw error;
          }
        );
  }

  return initPromise;
}
