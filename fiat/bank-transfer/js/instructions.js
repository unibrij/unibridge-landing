// fiat/bank-transfer/js/instructions.js

import {
  buildInstructionRows,
  buildCopyPayload,
  resolveTransferId
} from "./funding/bankInstructionRows.js";

import {
  normalizeString,
  formatLabel,
  escapeHtml,
  escapeAttribute,
  encodeCopyValue,
  decodeCopyValue,
  formatDisplayValue
} from "./funding/bankInstructionFormatters.js";

async function copyText(value) {
  if (
    !navigator.clipboard ||
    !navigator.clipboard.writeText
  ) {
    throw new Error(
      "clipboard_unavailable"
    );
  }

  await navigator.clipboard.writeText(
    value
  );

  return true;
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

  const rawValue =
    normalizeString(
      row.value
    );

  const displayValue =
    formatDisplayValue(
      row
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
          data-copy-value="${escapeAttribute(encodeCopyValue(rawValue))}"
          aria-label="Copy ${escapeAttribute(row.label)}"
        >
          Copy
        </button>
      </div>

      <div class="${valueClasses}">
        ${escapeHtml(displayValue)}
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
