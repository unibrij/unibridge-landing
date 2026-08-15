// fiat/bank-transfer/js/funding/transakVirtualAccountStep.js

import {
  createTransakVirtualAccount
} from "../api.js";

import {
  renderBankInstructions
} from "../instructions.js";

import {
  setStatus,
  setActiveStep,
  markStepDone,
  markStepFailed,
  showWaitingForFunding
} from "../status.js";


const RENDERABLE_BANK_FIELDS =
  new Set([
    "account_number",
    "bank_account_number",
    "routing_number",
    "bank_routing_number",
    "sort_code",
    "iban"
  ]);


function normalizeString(
  value
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeLower(
  value
) {
  return normalizeString(
    value
  ).toLowerCase();
}


function clearInstructionsBox(
  instructionsBox
) {
  if (!instructionsBox) {
    return;
  }

  instructionsBox.innerHTML =
    "";

  instructionsBox.classList.add(
    "hidden"
  );
}


function appendTypedBankField({
  instructions,
  field
}) {
  const type =
    normalizeLower(
      field?.type
    );

  const value =
    normalizeString(
      field?.value
    );

  if (
    !type ||
    !value ||
    !RENDERABLE_BANK_FIELDS.has(
      type
    )
  ) {
    return false;
  }

  instructions[type] =
    value;

  return true;
}


function resolveSourceAmount(
  state = {}
) {
  return (
    state
      ?.prepared_quote
      ?.form
      ?.amount ??

    state
      ?.prepared_quote
      ?.quote
      ?.amount ??

    null
  );
}


function buildRenderableFunding({
  funding,
  state
}) {
  const nextAction =
    funding?.next_action;

  if (
    !nextAction ||
    typeof nextAction !==
      "object" ||
    Array.isArray(
      nextAction
    )
  ) {
    return null;
  }

  const instructions =
    {};

  const fiatCurrency =
    normalizeString(
      nextAction.fiat_currency ||
      funding?.fiat_currency
    );

  const paymentRail =
    normalizeString(
      nextAction.payment_rail ||
      funding?.payment_rail
    );

  const sourceAmount =
    resolveSourceAmount(
      state
    );

  if (fiatCurrency) {
    instructions.currency =
      fiatCurrency;
  }

  if (paymentRail) {
    instructions.payment_rail =
      paymentRail;
  }

  if (
    sourceAmount !==
      undefined &&
    sourceAmount !==
      null &&
    String(
      sourceAmount
    ).trim() !==
      ""
  ) {
    instructions.amount =
      sourceAmount;
  }

  const hasBankAccount =
    appendTypedBankField({
      instructions,

      field:
        nextAction.bank_account
    });

  appendTypedBankField({
    instructions,

    field:
      nextAction.bank_local_code
  });

  if (!hasBankAccount) {
    return null;
  }

  return {
    ...funding,

    source_deposit_instructions:
      instructions
  };
}


function persistFundingSuccess({
  persist,
  funding,
  renderableFunding
}) {
  persist({
    latest_funding_response:
      renderableFunding,

    transak_virtual_account_id:
      funding
        ?.provider_context
        ?.provider_vba_id ||
      null,

    transak_virtual_account_binding_id:
      funding
        ?.provider_context
        ?.binding_id ||
      null,

    transak_virtual_account_error:
      null
  });
}

function persistFundingError({
  persist,
  funding = null,
  error
}) {
  persist({
    latest_funding_response:
      null,

    transak_virtual_account_id:
      funding
        ?.provider_context
        ?.provider_vba_id ||
      null,

    transak_virtual_account_binding_id:
      funding
        ?.provider_context
        ?.binding_id ||
      null,

    transak_virtual_account_error:
      normalizeString(
        error
      ) ||
      "transak_virtual_account_create_failed"
  });
}


function showInstructionsMissingStatus() {
  setActiveStep(
    "instructions"
  );

  markStepFailed(
    "instructions"
  );

  setStatus({
    kind:
      "error",

    message:
      "Bank-transfer instructions were not returned. Please retry or contact support."
  });
}

function showCreateFailedStatus(
  err = {}
) {
  setActiveStep(
    "instructions"
  );

  markStepFailed(
    "instructions"
  );

  setStatus({
    kind:
      "error",

    message:
      normalizeString(
        err?.message
      ) ||
      "Could not create bank-transfer instructions. Please retry."
  });
}


function buildInstructionsMissingResult() {
  return {
    ok:
      false,

    retryable:
      true,

    blocked:
      true,

    step:
      "instructions",

    error:
      "transak_virtual_account_instructions_missing"
  };
}

function buildCreateFailedResult(
  err = {}
) {
  return {
    ok:
      false,

    retryable:
      true,

    blocked:
      true,

    step:
      "instructions",

    error:
      normalizeString(
        err?.code
      ) ||
      "transak_virtual_account_create_failed",

    reason:
      normalizeString(
        err?.message
      ) ||
      null
  };
}


export async function runTransakVirtualAccountStep({
  settlementId,
  sourceRail,
  state,
  persist,
  instructionsBox
}) {
  setActiveStep(
    "instructions"
  );

  try {
    const funding =
      await createTransakVirtualAccount({
        settlement_id:
          settlementId,

        source_rail:
          sourceRail
      });

    const renderableFunding =
      buildRenderableFunding({
        funding,
        state
      });

    if (!renderableFunding) {
      clearInstructionsBox(
        instructionsBox
      );

      persistFundingError({
        persist,
        funding,
        error:
          "transak_virtual_account_instructions_missing"
      });

      showInstructionsMissingStatus();

      return buildInstructionsMissingResult();
    }

    renderBankInstructions(
      instructionsBox,
      renderableFunding
    );

    persistFundingSuccess({
      persist,
      funding,
      renderableFunding
    });

    markStepDone(
      "instructions"
    );

    showWaitingForFunding();

    return {
      ok:
        true,

      funding:
        renderableFunding
    };
  }
  catch (err) {
    clearInstructionsBox(
      instructionsBox
    );

    persistFundingError({
      persist,

      error:
        normalizeString(
          err?.message
        ) ||
        "transak_virtual_account_create_failed"
    });

    showCreateFailedStatus(
      err
    );

    return buildCreateFailedResult(
      err
    );
  }
}
