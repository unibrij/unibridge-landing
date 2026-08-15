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
    "iban",
    "bic",
    "swift",
    "clabe",
    "br_code",
    "pix_code"
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


/*
--------------------------------------------------
Typed Transak bank field

Transak exposes bank identifiers as:

  {
    type,
    value
  }

The existing UniBridge bank-instruction renderer uses
flat canonical instruction fields.

This adapter is intentionally local to the Transak
frontend step.

No generic renderer contract changes are required.
--------------------------------------------------
*/

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


/*
--------------------------------------------------
Existing quote amount

The bank-transfer flow already keeps the prepared
quote/form state.

Use it only for display.

The Transak VBA endpoint remains authoritative for
the bank-account details.
--------------------------------------------------
*/

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


/*
--------------------------------------------------
Adapt Transak VBA result to the existing bank
instruction renderer.

Backend response:

  next_action:
    fiat_currency
    payment_rail
    bank_account { type, value }
    bank_local_code { type, value }

Frontend renderer:

  source_deposit_instructions:
    currency
    payment_rail
    account_number / iban / ...
    routing_number / sort_code / ...

The adaptation remains Transak-specific here.
--------------------------------------------------
*/

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

  /*
  The bank-account identifier is the minimum usable
  instruction returned by the Transak sender.

  Do not render a card containing only currency/rail.
  */

  if (!hasBankAccount) {
    return null;
  }

  return {
    ...funding,

    source_deposit_instructions:
      instructions
  };
}


/*
--------------------------------------------------
Persistence
--------------------------------------------------
*/

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


/*
--------------------------------------------------
UI states
--------------------------------------------------
*/

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


/*
--------------------------------------------------
Transak Virtual Account funding step

KYC has already passed before this step is called.

The orchestration layer supplies the already-resolved
source rail.

The frontend sends only:

  settlement_id
  source_rail

Clerk authentication is attached by api.js.

The backend derives Customer Context and passes it to
the Transak sender.

No email, customer id, or Transak userIdentifier is
constructed by the frontend.
--------------------------------------------------
*/

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

    const rendered =
      renderBankInstructions(
        instructionsBox,
        renderableFunding
      );

    if (!rendered) {
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
