// fiat/bank-transfer/js/bankFundingSteps.js

import { runKyc } from "./kycFlow.js";

import { setActiveStep } from "./status.js";

import {
  runTosStep,
  showTosRequiredStatus
} from "./funding/tosStep.js";

import {
  runBridgeCustomerStep
} from "./funding/bridgeCustomerStep.js";

import {
  runBridgeBankTransferStep
} from "./funding/bankTransferStep.js";

import {
  runTransakVirtualAccountStep
} from "./funding/transakVirtualAccountStep.js";

function clearInstructionsBox(instructionsBox) {
  if (!instructionsBox) {
    return;
  }

  instructionsBox.innerHTML = "";
  instructionsBox.classList.add("hidden");
}

function isTosRequiredResult(result = {}) {
  return (
    result?.step === "tos" &&
    result?.error === "bridge_tos_not_accepted"
  );
}

function isBlockingResult(result = {}) {
  return (
    result?.blocked ||
    result?.retryable ||
    result?.ok === false
  );
}

export async function runBankFundingSteps({
  settlementId,
  state,
  query,
  persist,
  instructionsBox,
  onConfirm
}) {
  setActiveStep(
    "kyc"
  );

  const kycResult =
    await runKyc({
      settlementId,
      state,
      persist,
      onConfirm
    });

  if (
    kycResult?.redirected
  ) {
    return {
      redirected:
        true,

      step:
        "kyc"
    };
  }

  const senderId =
    state
      ?.prepared_quote
      ?.resolved
      ?.sender_id;

  if (
    senderId ===
    "transak_virtual_account"
  ) {
    const fundingResult =
      await runTransakVirtualAccountStep({
        settlementId,
        sourceRail:
          state
            ?.prepared_quote
            ?.form
            ?.source_rail,
        state,
        persist,
        instructionsBox
      });

    if (
      isBlockingResult(
        fundingResult
      )
    ) {
      return fundingResult;
    }

    return {
      ok:
        true,

      funding:
        fundingResult.funding
    };
  }

  if (
    senderId !==
    "bridge_bank_transfer"
  ) {
    clearInstructionsBox(
      instructionsBox
    );

    return {
      ok:
        false,

      blocked:
        true,

      retryable:
        false,

      step:
        "instructions",

      error:
        senderId
          ? "unsupported_bank_funding_sender"
          : "bank_funding_sender_missing"
    };
  }

  const tosResult =
    await runTosStep({
      settlementId,
      state,
      query,
      persist
    });

  if (
    tosResult?.redirected
  ) {
    return {
      redirected:
        true,

      step:
        "tos"
    };
  }

  if (
    tosResult?.retryable ||
    isTosRequiredResult(
      tosResult
    )
  ) {
    clearInstructionsBox(
      instructionsBox
    );

    showTosRequiredStatus();

    return tosResult;
  }

  const customerResult =
    await runBridgeCustomerStep({
      settlementId,
      persist,
      instructionsBox
    });

  if (
    isTosRequiredResult(
      customerResult
    )
  ) {
    clearInstructionsBox(
      instructionsBox
    );

    showTosRequiredStatus();

    return customerResult;
  }

  if (
    isBlockingResult(
      customerResult
    )
  ) {
    clearInstructionsBox(
      instructionsBox
    );

    return customerResult;
  }

  const fundingResult =
    await runBridgeBankTransferStep({
      settlementId,
      state,
      persist,
      instructionsBox
    });

  if (
    isBlockingResult(
      fundingResult
    )
  ) {
    return fundingResult;
  }

  return {
    ok:
      true,

    funding:
      fundingResult.funding
  };
}
