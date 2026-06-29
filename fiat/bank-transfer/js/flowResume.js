// fiat/bank-transfer/js/flowResume.js

import {
  getDefaultSourceRail
} from "./config.js";

import {
  invalidatePreparedQuote
} from "./entryState.js";

import {
  resetSettlementAttemptForSameUser
} from "./state.js";

import {
  renderBankInstructions
} from "./instructions.js";

import {
  resetStaleSettlementAttemptIfNeeded
} from "./settlementResume.js";

import {
  showFundingMode,
  showEntryMode
} from "./flowUi.js";

import {
  hideCustomerProfileForm
} from "./customerProfile.js";

import {
  setStatus,
  setPrimaryAction,
  showWaitingForFunding
} from "./status.js";

import {
  replaceRuntimeState
} from "./flowAuthOwner.js";

export function isReturnedFromBridgeTos(query = {}) {
  return (
    query.tos_accepted === "1" ||
    query.tos_accepted === "true"
  );
}

export function hasExistingInstructions(state = {}) {
  return Boolean(
    state.bridge_transfer_id &&
    state.bridge_transfer_state
  );
}

export function restoreExistingInstructions({
  state,
  instructionsBox
} = {}) {
  if (!state?.latest_funding_response) {
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

export function resetStaleSettlementAttempt({
  state,
  query,
  readFiatContext,
  runtime
} = {}) {
  const result =
    resetStaleSettlementAttemptIfNeeded({
      state,
      query,

      fiatContext:
        typeof readFiatContext === "function"
          ? readFiatContext()
          : null,

      defaultSourceRail:
        getDefaultSourceRail()
    });

  if (!result.reset) {
    return {
      reset:
        false
    };
  }

  const nextState =
    resetSettlementAttemptForSameUser({
      state,

      defaults: {
        source_rail:
          getDefaultSourceRail()
      }
    });

  replaceRuntimeState({
    state,
    nextState
  });

  invalidatePreparedQuote();

  if (runtime) {
    runtime.preparedQuote =
      null;

    runtime.autoResumeStarted =
      false;
  }

  hideCustomerProfileForm();

  return {
    reset:
      true,

    nextState,

    reason:
      "stale_settlement_attempt"
  };
}

export function scheduleAutoResumeAfterTosReturn({
  runtime,
  runBankTransferFlow
} = {}) {
  if (runtime?.autoResumeStarted) {
    return;
  }

  if (runtime) {
    runtime.autoResumeStarted =
      true;
  }

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
      runBankTransferFlow?.();
    },
    500
  );
}

export function initResumeState({
  state,
  query,
  persist,
  runtime,
  instructionsBox,
  runBankTransferFlow
} = {}) {
  if (isReturnedFromBridgeTos(query)) {
    persist({
      tos_pending:
        false,

      tos_accepted:
        true,

      bridge_tos_status:
        "accepted"
    });
  }

  if (query?.bank_verified_identity_ref) {
    persist({
      bank_verified_identity_ref:
        query.bank_verified_identity_ref
    });
  }

  if (state?.settlement_id) {
    showFundingMode();
  } else {
    showEntryMode();
  }

  if (hasExistingInstructions(state)) {
    hideCustomerProfileForm();

    restoreExistingInstructions({
      state,
      instructionsBox
    });

    return {
      handled:
        true,

      reason:
        "existing_instructions"
    };
  }

  if (state?.tos_pending) {
    hideCustomerProfileForm();

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

    return {
      handled:
        true,

      reason:
        "tos_pending"
    };
  }

  if (state?.settlement_id) {
    hideCustomerProfileForm();

    if (isReturnedFromBridgeTos(query)) {
      scheduleAutoResumeAfterTosReturn({
        runtime,
        runBankTransferFlow
      });

      return {
        handled:
          true,

        reason:
          "returned_from_bridge_tos"
      };
    }

    setStatus({
      message:
        "Ready to create bank transfer funding."
    });

    return {
      handled:
        true,

      reason:
        "settlement_ready"
    };
  }

  return {
    handled:
      false,

    reason:
      null
  };
}
