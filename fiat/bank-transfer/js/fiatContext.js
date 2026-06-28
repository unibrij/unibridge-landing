// fiat/bank-transfer/js/fiatContext.js

import {
  resolveSourceRail
} from "./config.js";

export const FIAT_CONTEXT_KEY =
  "unibridge_fiat_context";

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeUpper(value) {
  return normalizeString(value).toUpperCase();
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

function readFieldValue(id) {
  return normalizeString(
    getEl(id)?.value
  );
}

function writeFieldValue(id, value) {
  const el =
    getEl(id);

  if (!el) {
    return;
  }

  const normalized =
    normalizeString(value);

  if (normalized) {
    el.value =
      normalized;
  }
}

export function normalizeAmount(value) {
  const amount =
    Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("invalid_amount");
  }

  return amount;
}

function parseStoredFiatContext() {
  try {
    const raw =
      window.localStorage.getItem(
        FIAT_CONTEXT_KEY
      );

    if (!raw) {
      return {};
    }

    const parsed =
      JSON.parse(raw);

    return parsed && typeof parsed === "object"
      ? parsed
      : {};
  } catch {
    window.localStorage.removeItem(
      FIAT_CONTEXT_KEY
    );

    return {};
  }
}

export function saveFiatContext(context = {}) {
  const payload = {
    source_country:
      normalizeUpper(context.source_country),

    receiver_country:
      normalizeUpper(context.receiver_country),

    amount:
      normalizeAmount(context.amount),

    payment_method:
      "bank_transfer",

    flow_started_at:
      context.flow_started_at || Date.now(),

    updated_at:
      new Date().toISOString()
  };

  window.localStorage.setItem(
    FIAT_CONTEXT_KEY,
    JSON.stringify(payload)
  );

  return payload;
}

export function syncFiatContextFields() {
  const stored =
    parseStoredFiatContext();

  writeFieldValue(
    "sourceCountry",
    stored.source_country
  );

  writeFieldValue(
    "receiverCountry",
    stored.receiver_country
  );

  writeFieldValue(
    "amount",
    stored.amount
  );

  return stored;
}

export function readFiatContext() {
  const stored =
    parseStoredFiatContext();

  const sourceCountry =
    normalizeUpper(
      readFieldValue("sourceCountry") ||
        stored.source_country
    );

  const receiverCountry =
    normalizeUpper(
      readFieldValue("receiverCountry") ||
        stored.receiver_country
    );

  const amount =
    normalizeAmount(
      readFieldValue("amount") ||
        stored.amount
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

  saveFiatContext({
    source_country:
      sourceCountry,

    receiver_country:
      receiverCountry,

    amount,

    flow_started_at:
      stored.flow_started_at ||
      stored.started_at ||
      Date.now()
  });

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
    syncFiatContextFields();

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
        <strong>Enter bank-transfer details</strong>
        <span>
          Select the source country, destination country, and amount to get available bank-transfer routes.
        </span>
      </div>
    `;

    return null;
  }
}
