// fiat/bank-transfer/js/funding/bankTransferGuards.js

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeLower(value) {
  return normalizeString(value).toLowerCase();
}

function readNested(value, path = []) {
  let current =
    value;

  for (const key of path) {
    if (
      !current ||
      typeof current !== "object"
    ) {
      return null;
    }

    current =
      current[key];
  }

  return current;
}

function hasValue(value) {
  return normalizeString(value).length > 0;
}

function hasAnyValue(...values) {
  return values.some(
    value => hasValue(value)
  );
}

function hasAccountAndRouting({
  accountNumber,
  routingNumber,
  bankName,
  holderName
} = {}) {
  return (
    hasAnyValue(
      accountNumber
    ) &&
    hasAnyValue(
      routingNumber
    ) &&
    hasAnyValue(
      bankName,
      holderName
    )
  );
}

function hasAccountAndSortCode({
  accountNumber,
  sortCode,
  bankName,
  holderName
} = {}) {
  return (
    hasAnyValue(
      accountNumber
    ) &&
    hasAnyValue(
      sortCode
    ) &&
    hasAnyValue(
      bankName,
      holderName
    )
  );
}

function resolveSourceDepositInstructions(funding = {}) {
  return (
    funding.source_deposit_instructions ||
    funding.next_action?.instructions ||
    funding.deposit_instructions ||
    funding.bank_instructions ||
    funding.instructions ||
    funding.virtual_account?.source_deposit_instructions ||
    funding.bridge_virtual_account?.source_deposit_instructions ||
    funding.data?.source_deposit_instructions ||
    funding.data?.next_action?.instructions ||
    funding.data?.deposit_instructions ||
    null
  );
}

function hasRenderableInstructionsObject(instructions = {}) {
  if (
    !instructions ||
    typeof instructions !== "object"
  ) {
    return false;
  }

  /*
    Single-field rails:
    - SEPA / IBAN: iban
    - Brazil PIX virtual account: br_code
    - Mexico SPEI: clabe
  */
  if (
    hasAnyValue(
      instructions.iban,
      instructions.br_code,
      instructions.clabe
    )
  ) {
    return true;
  }

  /*
    US ACH / wire style:
    account number + routing number + at least bank/holder name.
  */
  if (
    hasAccountAndRouting({
      accountNumber:
        instructions.bank_account_number ||
        instructions.account_number,

      routingNumber:
        instructions.bank_routing_number ||
        instructions.routing_number,

      bankName:
        instructions.bank_name,

      holderName:
        instructions.account_holder_name ||
        instructions.bank_beneficiary_name
    })
  ) {
    return true;
  }

  /*
    UK Faster Payments style:
    account number + sort code + at least bank/holder name.
  */
  if (
    hasAccountAndSortCode({
      accountNumber:
        instructions.account_number ||
        instructions.bank_account_number,

      sortCode:
        instructions.sort_code,

      bankName:
        instructions.bank_name,

      holderName:
        instructions.account_holder_name ||
        instructions.bank_beneficiary_name
    })
  ) {
    return true;
  }

  return false;
}

export function isPendingBankTransferResponse(funding = {}) {
  const state =
    normalizeLower(
      funding.state
    );

  const reason =
    normalizeLower(
      funding.reason
    );

  const error =
    normalizeLower(
      funding.error
    );

  return (
    funding?.pending === true ||
    funding?.retryable === true ||
    funding?.blocked === true ||
    funding?.is_ready === false ||
    state.startsWith("bridge_customer_") ||
    reason.startsWith("bridge_customer_") ||
    error.startsWith("bridge_customer_")
  );
}

export function hasRenderableBankInstructions(funding = {}) {
  const instructions =
    resolveSourceDepositInstructions(
      funding
    );

  if (
    hasRenderableInstructionsObject(
      instructions
    )
  ) {
    return true;
  }

  if (
    hasRenderableInstructionsObject(
      funding
    )
  ) {
    return true;
  }

  const sourceInstructions = {
    bank_name:
      readNested(
        funding,
        ["source", "bank_name"]
      ),

    account_holder_name:
      readNested(
        funding,
        ["source", "account_holder_name"]
      ),

    bank_beneficiary_name:
      readNested(
        funding,
        ["source", "bank_beneficiary_name"]
      ),

    bank_account_number:
      readNested(
        funding,
        ["source", "bank_account_number"]
      ),

    account_number:
      readNested(
        funding,
        ["source", "account_number"]
      ),

    bank_routing_number:
      readNested(
        funding,
        ["source", "bank_routing_number"]
      ),

    routing_number:
      readNested(
        funding,
        ["source", "routing_number"]
      ),

    iban:
      readNested(
        funding,
        ["source", "iban"]
      ),

    br_code:
      readNested(
        funding,
        ["source", "br_code"]
      ),

    clabe:
      readNested(
        funding,
        ["source", "clabe"]
      ),

    sort_code:
      readNested(
        funding,
        ["source", "sort_code"]
      )
  };

  return hasRenderableInstructionsObject(
    sourceInstructions
  );
}

export function buildBankTransferPendingResult(funding = {}) {
  return {
    ok:
      false,

    retryable:
      funding.retryable !== false,

    blocked:
      true,

    pending:
      funding.pending === true,

    step:
      "instructions",

    error:
      funding.reason ||
      funding.state ||
      funding.error ||
      "bridge_bank_transfer_not_ready",

    state:
      funding.state || null,

    reason:
      funding.message ||
      funding.reason ||
      "Your funding profile is not ready for bank-transfer instructions yet. Please refresh status."
  };
}

export function buildBankTransferInstructionsMissingResult(funding = {}) {
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
      "bridge_bank_transfer_instructions_missing",

    state:
      funding.state || null,

    reason:
      "Bank-transfer instructions were not returned. Please refresh status or contact support."
  };
}
