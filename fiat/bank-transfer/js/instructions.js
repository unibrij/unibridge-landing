// fiat/bank-transfer/js/instructions.js

function normalizeString(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
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

function escapeAttribute(value) {
  return escapeHtml(value);
}

function encodeCopyValue(value) {
  return encodeURIComponent(
    normalizeString(value)
  );
}

function decodeCopyValue(value) {
  try {
    return decodeURIComponent(
      normalizeString(value)
    );
  } catch {
    return normalizeString(value);
  }
}

async function copyText(value) {
  if (
    !navigator.clipboard ||
    !navigator.clipboard.writeText
  ) {
    throw new Error("clipboard_unavailable");
  }

  await navigator.clipboard.writeText(
    value
  );

  return true;
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
        true
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

function resolveInstructionTitle() {
  return "Send your bank transfer";
}

function resolveInstructionSubtext(funding = {}) {
  const state =
    normalizeString(
      funding.bridge_transfer_state ||
      funding.state
    );

  if (state) {
    return `Status: ${formatLabel(state)}.`;
  }

  return "Use the details below exactly as shown.";
}

function resolveTransferId(funding = {}) {
  return normalizeString(
    funding.bridge_transfer_id ||
    funding.transfer_id ||
    funding.id
  );
}

function buildCopyPayload(rows = []) {
  return rows
    .map(row => `${row.label}: ${normalizeString(row.value)}`)
    .join("\n");
}

function renderInstructionRow(row) {
  const classes = [
    "bank-instruction-item",
    row.important ? "important" : "",
    row.reference ? "reference" : "",
    row.wide ? "wide" : ""
  ]
    .filter(Boolean)
    .join(" ");

  const valueClasses = [
    "bank-instruction-value",
    row.mono ? "mono" : ""
  ]
    .filter(Boolean)
    .join(" ");

  const value =
    normalizeString(
      row.value
    );

  return `
    <div class="${classes}">
      <div class="bank-instruction-row-top">
        <div class="bank-instruction-label">
          ${escapeHtml(row.label)}
        </div>

        <button
          type="button"
          class="bank-copy-button"
          data-copy-value="${escapeAttribute(encodeCopyValue(value))}"
          aria-label="Copy ${escapeAttribute(row.label)}"
        >
          Copy
        </button>
      </div>

      <div class="${valueClasses}">
        ${escapeHtml(value)}
      </div>
    </div>
  `;
}

function attachCopyHandlers(instructionsBox) {
  const buttons =
    instructionsBox.querySelectorAll(
      "[data-copy-value]"
    );

  buttons.forEach(button => {
    button.addEventListener("click", async () => {
      const value =
        decodeCopyValue(
          button.getAttribute(
            "data-copy-value"
          ) || ""
        );

      const originalText =
        normalizeString(
          button.textContent
        ) || "Copy";

      try {
        await copyText(
          value
        );

        button.textContent =
          "Copied";

        button.classList.add(
          "copied"
        );

        window.setTimeout(() => {
          button.textContent =
            originalText;

          button.classList.remove(
            "copied"
          );
        }, 1200);
      } catch {
        button.textContent =
          "Unavailable";

        button.classList.add(
          "failed"
        );

        window.setTimeout(() => {
          button.textContent =
            originalText;

          button.classList.remove(
            "failed"
          );
        }, 1200);
      }
    });
  });
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

  const transferId =
    resolveTransferId(
      funding
    );

  const copyAllPayload =
    buildCopyPayload(
      rows
    );

  instructionsBox.innerHTML =
    `
      <div class="bank-instructions-card">
        <div class="bank-instructions-header">
          <div>
            <div class="bank-instructions-kicker">
              Bank transfer instructions
            </div>

            <h3 class="bank-instructions-title">
              ${escapeHtml(title)}
            </h3>

            <p class="bank-instructions-subtext">
              ${escapeHtml(subtext)}
            </p>
          </div>

          <button
            type="button"
            class="bank-copy-all-button"
            data-copy-value="${escapeAttribute(encodeCopyValue(copyAllPayload))}"
            aria-label="Copy all bank transfer instructions"
          >
            Copy all
          </button>
        </div>

        ${
          transferId
            ? `
              <div class="bank-transfer-id">
                <span>Transfer ID</span>
                <strong>${escapeHtml(transferId)}</strong>
              </div>
            `
            : ""
        }

        <div class="bank-instructions-list">
          ${rows.map(renderInstructionRow).join("")}
        </div>

        <div class="bank-instructions-note">
          Important: send the exact amount and use the deposit message/reference exactly as shown.
        </div>
      </div>
    `;

  instructionsBox.classList.remove(
    "hidden"
  );

  attachCopyHandlers(
    instructionsBox
  );

  return true;
}
