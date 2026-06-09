// fiat/bank-transfer/js/instructions.js

function normalizeString(value) {
  return String(value || "").trim();
}

function hasValue(value) {
  return normalizeString(value).length > 0;
}

function formatLabel(value) {
  return normalizeString(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

function escapeHtml(value) {
  return normalizeString(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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
    null
  );
}

function resolveValue(instructions = {}, funding = {}, keys = []) {
  for (const key of keys) {
    if (hasValue(instructions[key])) {
      return instructions[key];
    }

    if (hasValue(funding[key])) {
      return funding[key];
    }
  }

  return null;
}

function buildInstructionRows(funding = {}) {
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
        )
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
        )
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
        )
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
        )
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
        )
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
        )
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
        )
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
        )
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
        )
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
        )
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
        )
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
        )
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
        )
    }
  ];

  return rows.filter(
    row => hasValue(row.value)
  );
}

function resolveInstructionTitle(funding = {}) {
  return (
    funding.next_action?.label ||
    funding.label ||
    "Send the bank transfer using the instructions below."
  );
}

function resolveInstructionSubtext(funding = {}) {
  const state =
    normalizeString(
      funding.bridge_transfer_state ||
      funding.state
    );

  const transferId =
    normalizeString(
      funding.bridge_transfer_id ||
      funding.transfer_id
    );

  if (
    state &&
    transferId
  ) {
    return `Transfer ${transferId} is ${formatLabel(state)}.`;
  }

  if (state) {
    return `Transfer status: ${formatLabel(state)}.`;
  }

  if (transferId) {
    return `Transfer ID: ${transferId}.`;
  }

  return "";
}

function renderInstructionRow(row) {
  return `
    <div class="bank-instruction-row">
      <div class="bank-instruction-label">
        ${escapeHtml(row.label)}
      </div>
      <div class="bank-instruction-value">
        ${escapeHtml(row.value)}
      </div>
    </div>
  `;
}

export function renderBankInstructions(
  instructionsBox,
  funding = {}
) {
  if (!instructionsBox) {
    return false;
  }

  const rows =
    buildInstructionRows(
      funding
    );

  if (!rows.length) {
    instructionsBox.innerHTML =
      "";

    instructionsBox.classList.add(
      "hidden"
    );

    return false;
  }

  const title =
    resolveInstructionTitle(
      funding
    );

  const subtext =
    resolveInstructionSubtext(
      funding
    );

  instructionsBox.innerHTML =
    `
      <div class="bank-instructions-card">
        <div class="bank-instructions-header">
          <div class="bank-instructions-kicker">
            Bank transfer instructions
          </div>

          <h3 class="bank-instructions-title">
            ${escapeHtml(title)}
          </h3>

          ${
            subtext
              ? `
                <p class="bank-instructions-subtext">
                  ${escapeHtml(subtext)}
                </p>
              `
              : ""
          }
        </div>

        <div class="bank-instructions-list">
          ${rows.map(renderInstructionRow).join("")}
        </div>

        <div class="bank-instructions-note">
          Use the deposit message/reference exactly as shown when sending the transfer.
        </div>
      </div>
    `;

  instructionsBox.classList.remove(
    "hidden"
  );

  return true;
}
