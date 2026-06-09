// fiat/bank-transfer/js/funding/bankTransferStep.js

import { createBridgeBankTransfer } from "../api.js";

import { renderBankInstructions } from "../instructions.js";

import {
  setStatus,
  setActiveStep,
  markStepDone,
  markStepFailed,
  showWaitingForFunding
} from "../status.js";

import {
  isPendingBankTransferResponse,
  hasRenderableBankInstructions,
  buildBankTransferPendingResult,
  buildBankTransferInstructionsMissingResult
} from "./bankTransferGuards.js";

import {
  resolveErrorStatus,
  resolveErrorCode,
  resolveReadableErrorMessage,
  resolveUserFacingBankTransferMessage,
  buildBankTransferCreateFailedResult
} from "./bridgeBankTransferErrors.js";

function clearInstructionsBox(instructionsBox) {
  if (!instructionsBox) {
    return;
  }

  instructionsBox.innerHTML = "";
  instructionsBox.classList.add("hidden");
}

function showBankTransferCreateFailedStatus(err = {}) {
  setActiveStep("instructions");
  markStepFailed("instructions");

  setStatus({
    kind: "error",
    message: resolveUserFacingBankTransferMessage(err)
  });
}

function showBankTransferPendingStatus(funding = {}) {
  setActiveStep("instructions");
  markStepFailed("instructions");

  setStatus({
    kind: "warning",
    message:
      funding.message ||
      funding.reason ||
      funding.state ||
      funding.error ||
      "Your funding profile is not ready for bank-transfer instructions yet. Please refresh status."
  });
}

function showBankTransferInstructionsMissingStatus(result = {}) {
  setActiveStep("instructions");
  markStepFailed("instructions");

  setStatus({
    kind: "error",
    message:
      result.reason ||
      "Bank-transfer instructions were not returned. Please refresh status or contact support."
  });
}

function persistFundingError({
  persist,
  funding,
  error,
  status = null,
  code = null
}) {
  persist({
    latest_funding_response:
      funding,

    bridge_transfer_id:
      funding?.bridge_transfer_id ||
      null,

    bridge_transfer_state:
      funding?.bridge_transfer_state ||
      null,

    bridge_bank_transfer_error:
      error,

    bridge_bank_transfer_error_status:
      status,

    bridge_bank_transfer_error_code:
      code
  });
}

function persistFundingCreateError({
  persist,
  err
}) {
  persist({
    latest_funding_response:
      null,

    bridge_transfer_id:
      null,

    bridge_transfer_state:
      null,

    bridge_bank_transfer_error:
      resolveReadableErrorMessage(err),

    bridge_bank_transfer_error_status:
      resolveErrorStatus(err) || null,

    bridge_bank_transfer_error_code:
      resolveErrorCode(err) || null
  });
}

function persistFundingSuccess({
  persist,
  funding
}) {
  persist({
    bridge_transfer_id:
      funding.bridge_transfer_id || null,

    bridge_transfer_state:
      funding.bridge_transfer_state || null,

    latest_funding_response:
      funding,

    bridge_bank_transfer_error:
      null,

    bridge_bank_transfer_error_status:
      null,

    bridge_bank_transfer_error_code:
      null
  });
}

export async function runBridgeBankTransferStep({
  settlementId,
  state,
  persist,
  instructionsBox
}) {
  setActiveStep(
    "instructions"
  );

  try {
    const funding =
      await createBridgeBankTransfer({
        settlement_id:
          settlementId,

        source_country:
          state.source_country,

        source_rail:
          state.source_rail
      });

    if (
      isPendingBankTransferResponse(
        funding
      )
    ) {
      clearInstructionsBox(
        instructionsBox
      );

      persistFundingError({
        persist,
        funding,
        error:
          funding.message ||
          funding.reason ||
          funding.state ||
          funding.error ||
          "bridge_bank_transfer_not_ready",

        status:
          funding.status || null,

        code:
          funding.code ||
          funding.reason ||
          funding.state ||
          funding.error ||
          null
      });

      showBankTransferPendingStatus(
        funding
      );

      return buildBankTransferPendingResult(
        funding
      );
    }

    if (
      !hasRenderableBankInstructions(
        funding
      )
    ) {
      clearInstructionsBox(
        instructionsBox
      );

      const result =
        buildBankTransferInstructionsMissingResult(
          funding
        );

      persistFundingError({
        persist,
        funding,
        error:
          result.error,

        status:
          null,

        code:
          result.error
      });

      showBankTransferInstructionsMissingStatus(
        result
      );

      return result;
    }

    const rendered =
      renderBankInstructions(
        instructionsBox,
        funding
      );

    if (!rendered) {
      clearInstructionsBox(
        instructionsBox
      );

      const result =
        buildBankTransferInstructionsMissingResult(
          funding
        );

      persistFundingError({
        persist,
        funding,
        error:
          result.error,

        status:
          null,

        code:
          result.error
      });

      showBankTransferInstructionsMissingStatus(
        result
      );

      return result;
    }

    persistFundingSuccess({
      persist,
      funding
    });

    markStepDone(
      "instructions"
    );

    showWaitingForFunding();

    return {
      ok:
        true,

      funding
    };
  } catch (err) {
    clearInstructionsBox(
      instructionsBox
    );

    persistFundingCreateError({
      persist,
      err
    });

    showBankTransferCreateFailedStatus(
      err
    );

    return buildBankTransferCreateFailedResult(
      err
    );
  }
}
