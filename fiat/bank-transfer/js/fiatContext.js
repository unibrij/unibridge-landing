// fiat/bank-transfer/js/fiatContext.js

import {
  resolveSourceRail
} from "./config.js";

export const FIAT_CONTEXT_KEY =
  "unibridge_fiat_context";

function normalizeString(value) {
  return String(value || "").trim();
}

function escapeHtml(value) {
  return normalizeString(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getEl(id) {
  return document.getElementById(id);
}

export function normalizeAmount(value) {
  const amount =
    Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("invalid_amount");
  }

  return amount;
}

export function readFiatContext() {
  const raw =
    window.localStorage.getItem(
      FIAT_CONTEXT_KEY
    );

  if (!raw) {
    throw new Error("missing_fiat_context");
  }

  const parsed =
    JSON.parse(raw);

  const sourceCountry =
    normalizeString(
      parsed.source_country
    ).toUpperCase();

  const receiverCountry =
    normalizeString(
      parsed.receiver_country
    ).toUpperCase();

  const amount =
    normalizeAmount(
      parsed.amount
    );

  if (!sourceCountry) {
    throw new Error("missing_source_country");
  }

  if (!receiverCountry) {
    throw new Error("missing_receiver_country");
  }

  const rail =
    resolveSourceRail(
      sourceCountry
    );

  return {
    source_country:
      rail.source_country,

    source_rail:
      rail.source_rail,

    receiver_country:
      receiverCountry,

    amount
  };
}

export function renderContextSummary() {
  const box =
    getEl("contextSummary");

  if (!box) {
    return null;
  }

  try {
    const context =
      readFiatContext();

    box.innerHTML = `
      <div class="summary-grid">
        <div class="summary-item">
          <span>Source</span>
          <strong>${escapeHtml(context.source_country)} / ${escapeHtml(context.source_rail)}</strong>
        </div>

        <div class="summary-item">
          <span>Destination</span>
          <strong>${escapeHtml(context.receiver_country)}</strong>
        </div>

        <div class="summary-item">
          <span>Amount</span>
          <strong>${escapeHtml(context.amount)}</strong>
        </div>
      </div>
    `;

    return context;
  } catch {
    box.innerHTML = `
      <div class="summary-empty">
        <strong>Start from Pay with UniBridge</strong>
        <span>
          Choose fiat funding, enter the source country, destination country,
          and amount, then continue to bank transfer.
        </span>
        <a class="summary-link" href="/pay">
          Start from Pay with UniBridge
        </a>
      </div>
    `;

    return null;
  }
}
