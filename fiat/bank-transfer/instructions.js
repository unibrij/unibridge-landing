// fiat/bank-transfer/js/instructions.js

function normalizeString(value) {
  return String(value || "").trim();
}

function pickFirstString(...values) {
  for (const value of values) {
    const normalized =
      normalizeString(value);

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function escapeHtml(value) {
  return normalizeString(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeInstructions(value = {}) {
  return (
    value.next_action?.instructions ||
    value.source_deposit_instructions ||
    value.instructions ||
    {}
  );
}

function buildInstructionRows(instructions = {}) {
  return [
    {
      label: "Bank name",
      value:
        pickFirstString(
          instructions.bank_name,
          instructions.bank?.name
        )
    },

    {
      label: "Account holder",
      value:
        pickFirstString(
          instructions.beneficiary_name,
          instructions.account_holder_name,
          instructions.account_name
        )
    },

    {
      label: "Account number",
      value:
        pickFirstString(
          instructions.account_number,
          instructions.bank_account_number
        )
    },

    {
      label: "Routing number",
      value:
        pickFirstString(
          instructions.routing_number,
          instructions.ach_routing_number
        )
    },

    {
      label: "IBAN",
      value:
        pickFirstString(
          instructions.iban
        )
    },

    {
      label: "SWIFT / BIC",
      value:
        pickFirstString(
          instructions.swift_code,
          instructions.bic
        )
    },

    {
      label: "Reference",
      className:
        "reference",
      value:
        pickFirstString(
          instructions.deposit_message,
          instructions.reference,
          instructions.memo
        )
    },

    {
      label: "Address",
      value:
        pickFirstString(
          instructions.bank_address,
          instructions.beneficiary_address
        )
    }
  ].filter((row) => row.value);
}

export function renderBankInstructions(
  container,
  bridgeFunding
) {
  if (!container) {
    return;
  }

  const instructions =
    normalizeInstructions(
      bridgeFunding
    );

  const rows =
    buildInstructionRows(
      instructions
    );

  if (!rows.length) {
    container.classList.add("hidden");
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <div class="instructions-header">
      <h2>Bank transfer instructions</h2>
      <p>
        Send the transfer exactly as shown.
        Include the reference if provided.
      </p>
    </div>

    <div class="instruction-grid">
      ${rows.map((row) => `
        <div class="instruction-row">
          <div class="instruction-label">
            ${escapeHtml(row.label)}
          </div>

          <div class="instruction-value ${escapeHtml(row.className || "")}">
            ${escapeHtml(row.value)}
          </div>
        </div>
      `).join("")}
    </div>
  `;

  container.classList.remove(
    "hidden"
  );
}
