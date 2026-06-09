// fiat/bank-transfer/js/funding/bankInstructionRows.js

import {
  hasValue,
  normalizeString
} from "./bankInstructionFormatters.js";

function resolveBankInstructions(funding = {}) {
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
    funding.data?.bank_instructions ||
    funding.data?.instructions ||
    funding.data?.virtual_account?.source_deposit_instructions ||
    funding.data?.bridge_virtual_account?.source_deposit_instructions ||
    null
  );
}

function resolveValue(
  instructions = {},
  funding = {},
  keys = []
) {
  for (const key of keys) {
    if (
      hasValue(
        instructions[key]
      )
    ) {
      return instructions[key];
    }

    if (
      hasValue(
        funding[key]
      )
    ) {
      return funding[key];
    }
  }

  return null;
}

export function buildInstructionRows(funding = {}) {
  const instructions =
    resolveBankInstructions(
      funding
    ) || {};

  const rows = [
    {
      label:
        "Payment rail",

      value:
        resolveValue(
          instructions,
          funding,
          [
            "payment_rail",
            "source_rail",
            "rail"
          ]
        ),

      formatter:
        "rail"
    },
    {
      label:
        "Currency",

      value:
        resolveValue(
          instructions,
          funding,
          [
            "currency",
            "source_currency"
          ]
        ),

      formatter:
        "uppercase"
    },
    {
      label:
        "Amount",

      value:
        resolveValue(
          instructions,
          funding,
          [
            "amount",
            "source_amount"
          ]
        ),

      important:
        true
    },
    {
      label:
        "Bank name",

      value:
        resolveValue(
          instructions,
          funding,
          [
            "bank_name"
          ]
        )
    },
    {
      label:
        "Routing number",

      value:
        resolveValue(
          instructions,
          funding,
          [
            "bank_routing_number",
            "routing_number"
          ]
        ),

      mono:
        true
    },
    {
      label:
        "Account number",

      value:
        resolveValue(
          instructions,
          funding,
          [
            "bank_account_number",
            "account_number"
          ]
        ),

      mono:
        true
    },
    {
      label:
        "Beneficiary name",

      value:
        resolveValue(
          instructions,
          funding,
          [
            "bank_beneficiary_name",
            "account_holder_name",
            "beneficiary_name"
          ]
        )
    },
    {
      label:
        "Beneficiary address",

      value:
        resolveValue(
          instructions,
          funding,
          [
            "bank_beneficiary_address",
            "beneficiary_address"
          ]
        ),

      wide:
        true
    },
    {
      label:
        "Bank address",

      value:
        resolveValue(
          instructions,
          funding,
          [
            "bank_address"
          ]
        ),

      wide:
        true
    },
    {
      label:
        "Deposit message",

      value:
        resolveValue(
          instructions,
          funding,
          [
            "deposit_message",
            "memo",
            "reference",
            "payment_reference"
          ]
        ),

      reference:
        true,

      mono:
        true,

      wide:
        true
    },
    {
      label:
        "IBAN",

      value:
        resolveValue(
          instructions,
          funding,
          [
            "iban"
          ]
        ),

      mono:
        true,

      wide:
        true
    },
    {
      label:
        "BIC / SWIFT",

      value:
        resolveValue(
          instructions,
          funding,
          [
            "bic",
            "swift"
          ]
        ),

      mono:
        true,

      formatter:
        "uppercase"
    },
    {
      label:
        "PIX code",

      value:
        resolveValue(
          instructions,
          funding,
          [
            "br_code",
            "pix_code"
          ]
        ),

      mono:
        true,

      wide:
        true
    },
    {
      label:
        "CLABE",

      value:
        resolveValue(
          instructions,
          funding,
          [
            "clabe"
          ]
        ),

      mono:
        true
    },
    {
      label:
        "Sort code",

      value:
        resolveValue(
          instructions,
          funding,
          [
            "sort_code"
          ]
        ),

      mono:
        true
    }
  ];

  return rows.filter(
    row => hasValue(
      row.value
    )
  );
}

export function buildCopyPayload(rows = []) {
  return rows
    .map(row => {
      const value =
        normalizeString(
          row.value
        );

      return `${row.label}: ${value}`;
    })
    .join("\n");
}

export function resolveTransferId(funding = {}) {
  return normalizeString(
    funding.bridge_transfer_id ||
    funding.transfer_id ||
    funding.id
  );
}
