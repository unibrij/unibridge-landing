// fiat/bank-transfer/js/flowHandlers.js

import {
  createSettlementFromPreparedQuote,
  prepareBankTransferSettlement,
  renderQuote
} from "./entryForm.js";

import {
  clearDiditAutoContinue
} from "./kycFlow.js";

import {
  runBankFundingSteps
} from "./bankFundingSteps.js";

import {
  ensureCustomerProfileFromForm,
  hideCustomerProfileForm
} from "./customerProfile.js";

import {
  setStatus,
  markStepFailed,
  setPrimaryAction
} from "./status.js";

import {
  showFundingMode,
  setEntryButtonsForQuoteStart,
  setEntryButtonsForQuoteReady,
  setEntryButtonsForQuoteIdle,
  setCreateSettlementBusy,
  setCreateSettlementIdle,
  resetEntryButtonsAfterAuthReset
} from "./flowUi.js";

import {
  hasPreparedQuote,
  showCustomerProfileAfterQuote,
  handleCustomerProfileError
} from "./quoteProfileGate.js";

import {
  resolveErrorMessage
} from "./flowErrors.js";

import {
  hasExistingInstructions,
  restoreExistingInstructions
} from "./flowResume.js";

function requireSettlementId(state = {}) {
  if (!state.settlement_id) {
    throw new Error("missing_settlement_id");
  }

  return state.settlement_id;
}

function applyAuthResetUi({
  runtime,
  hasFiatContext,
  showEntryMode
} = {}) {
  if (runtime) {
    runtime.preparedQuote =
      null;

    runtime.autoResumeStarted =
      false;
  }

  hideCustomerProfileForm();

  showEntryMode?.();

  resetEntryButtonsAfterAuthReset({
    hasFiatContext:
      typeof hasFiatContext === "function"
        ? hasFiatContext()
        : false
  });
}

export function createBankTransferHandlers({
  state,
  query,
  runtime,
  quoteBox,
  instructionsBox,
  persist,
  hasFiatContext,
  goToPayEntry,
  readFiatContextStartedAt,
  syncAuthOwnerOrReset,
  showEntryMode
} = {}) {
  async function runBankTransferFlow() {
    try {
      const authSync =
        await syncAuthOwnerOrReset({
          resetUi:
            true
        });

      if (authSync.reset) {
        applyAuthResetUi({
          runtime,
          hasFiatContext,
          showEntryMode
        });

        return;
      }

      showFundingMode();

      setPrimaryAction({
        label:
          "Processing…",

        disabled:
          true
      });

      const settlementId =
        requireSettlementId(
          state
        );

      if (
        hasExistingInstructions(
          state
        ) &&
        restoreExistingInstructions({
          state,
          instructionsBox
        })
      ) {
        return;
      }

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

      if (
        handleCustomerProfileError({
          err,
          preparedQuote:
            runtime.preparedQuote,
          resolveErrorMessage,
          setStatus
        })
      ) {
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
      hideCustomerProfileForm();

      setEntryButtonsForQuoteStart();

      const authSync =
        await syncAuthOwnerOrReset({
          resetUi:
            true
        });

      if (authSync.reset) {
        applyAuthResetUi({
          runtime,
          hasFiatContext,
          showEntryMode
        });

        return;
      }

      runtime.preparedQuote =
        await prepareBankTransferSettlement();

      persist({
        prepared_quote:
          runtime.preparedQuote,

        source_country:
          runtime.preparedQuote.form?.source_country,

        source_rail:
          runtime.preparedQuote.form?.source_rail
      });

      renderQuote(
        quoteBox,
        {
          form:
            runtime.preparedQuote.form,

          quote:
            runtime.preparedQuote.quote,

          selectedRoute:
            runtime.preparedQuote.selected_route
        }
      );

      showCustomerProfileAfterQuote({
        preparedQuote:
          runtime.preparedQuote
      });

      setEntryButtonsForQuoteReady({
        hasPreparedQuote:
          hasPreparedQuote(
            runtime.preparedQuote
          )
      });
    } catch (err) {
      runtime.preparedQuote =
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

      setEntryButtonsForQuoteIdle({
        hasFiatContext:
          hasFiatContext()
      });
    }
  }

  async function handleCreateSettlement() {
    try {
      const authSync =
        await syncAuthOwnerOrReset({
          resetUi:
            true
        });

      if (authSync.reset) {
        applyAuthResetUi({
          runtime,
          hasFiatContext,
          showEntryMode
        });

        return;
      }

      if (
        !hasPreparedQuote(
          runtime.preparedQuote
        )
      ) {
        hideCustomerProfileForm();

        setEntryButtonsForQuoteIdle({
          hasFiatContext:
            hasFiatContext()
        });

        setStatus({
          kind:
            "warning",

          message:
            "Please get a quote first."
        });

        return;
      }

      setCreateSettlementBusy();

      ensureCustomerProfileFromForm();

      const created =
        await createSettlementFromPreparedQuote(
          runtime.preparedQuote
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

      if (
        handleCustomerProfileError({
          err,
          preparedQuote:
            runtime.preparedQuote,
          resolveErrorMessage,
          setStatus
        })
      ) {
        setCreateSettlementIdle({
          hasPreparedQuote:
            true
        });

        return;
      }

      if (err?.handled === true) {
        setCreateSettlementIdle({
          hasPreparedQuote:
            hasPreparedQuote(
              runtime.preparedQuote
            )
        });

        return;
      }

      alert(
        resolveErrorMessage(err) ||
        "Could not create payout route"
      );

      setCreateSettlementIdle({
        hasPreparedQuote:
          hasPreparedQuote(
            runtime.preparedQuote
          )
      });
    }
  }

  async function syncInitialAuthBeforeResume() {
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
      resetUi:
        true
    });
  }

  return {
    runBankTransferFlow,
    handleQuote,
    handleCreateSettlement,
    syncInitialAuthBeforeResume
  };
}
