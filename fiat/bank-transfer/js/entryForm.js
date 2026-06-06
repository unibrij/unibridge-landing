// fiat/bank-transfer/js/entryForm.js

import {
  getDefaultSourceRail
} from "./config.js";

import {
  createSettlement,
  quoteSession,
  registerSession,
  resolveSession
} from "./sessionApi.js";

const FIAT_CONTEXT_KEY =
  "unibridge_fiat_context";

let availableRoutes = [];
let latestContext = null;
let latestQuote = null;

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

function normalizeAmount(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("invalid_amount");
  }

  return amount;
}

function getEl(id) {
  return document.getElementById(id);
}

function resolveSourceRail(sourceCountry) {
  const country =
    normalizeString(sourceCountry).toUpperCase();

  if (country === "US" || country === "USA") {
    return {
      source_country: "US",
      source_rail: "ach_push"
    };
  }

  if (country === "EU") {
    return {
      source_country: "EU",
      source_rail: "sepa"
    };
  }

  if (country === "GB" || country === "UK") {
    return {
      source_country: "GB",
      source_rail: "faster_payments"
    };
  }

  return getDefaultSourceRail();
}

function readFiatContext() {
  const raw =
    localStorage.getItem(FIAT_CONTEXT_KEY);

  if (!raw) {
    throw new Error("missing_fiat_context");
  }

  const parsed =
    JSON.parse(raw);

  const source_country =
    normalizeString(parsed.source_country).toUpperCase();

  const receiver_country =
    normalizeString(parsed.receiver_country).toUpperCase();

  const amount =
    normalizeAmount(parsed.amount);

  if (!source_country) {
    throw new Error("missing_source_country");
  }

  if (!receiver_country) {
    throw new Error("missing_receiver_country");
  }

  const rail =
    resolveSourceRail(source_country);

  return {
    source_country:
      rail.source_country,

    source_rail:
      rail.source_rail,

    receiver_country,

    amount
  };
}

export function renderContextSummary() {
  const box =
    getEl("contextSummary");

  if (!box) {
    return;
  }

  try {
    const context =
      readFiatContext();

    latestContext =
      context;

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
  }
}

function normalizeField(field = {}) {
  const name =
    normalizeString(
      field.name ||
      field.key ||
      field.id
    );

  if (!name) {
    return null;
  }

  return {
    name,

    label:
      normalizeString(field.label) ||
      name,

    type:
      normalizeString(field.type) ||
      "text",

    required:
      field.required !== false
  };
}

function resolveRouteFields(route = {}) {
  const candidates = [
    route.required_destination_fields,
    route.destination_fields,
    route.destination_schema,
    route.instruction_schema,
    route.schema
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate
        .map(normalizeField)
        .filter(Boolean);
    }

    if (
      candidate &&
      typeof candidate === "object" &&
      Array.isArray(candidate.fields)
    ) {
      return candidate.fields
        .map(normalizeField)
        .filter(Boolean);
    }
  }

  return [];
}

function normalizeRoute(route = {}) {
  const routeId =
    normalizeString(
      route.route_id ||
      route.id
    );

  if (!routeId) {
    return null;
  }

  return {
    ...route,

    route_id:
      routeId,

    label:
      normalizeString(route.label) ||
      normalizeString(route.name) ||
      routeId,

    receiver_country:
      normalizeString(route.receiver_country).toUpperCase(),

    payout_rail:
      normalizeString(
        route.payout_rail ||
        route.expected_payout_rail
      ),

    required_destination_fields:
      resolveRouteFields(route)
  };
}

function resolveRoutesPayload(payload = {}) {
  const rawRoutes =
    Array.isArray(payload.routes)
      ? payload.routes
      : Array.isArray(payload.data)
        ? payload.data
        : [];

  return rawRoutes
    .map(normalizeRoute)
    .filter(Boolean)
    .filter((route) => route.enabled !== false);
}

export async function loadBankTransferRoutes() {
  renderContextSummary();

  const select =
    getEl("routeId");

  if (select) {
    select.disabled = true;
    select.innerHTML =
      `<option value="">Get quote first</option>`;
  }

  return [];
}

function getSelectedRouteId() {
  return normalizeString(
    getEl("routeId")?.value
  );
}

function getSelectedRoute() {
  const selectedRouteId =
    getSelectedRouteId();

  const route =
    availableRoutes.find((item) => {
      return item.route_id === selectedRouteId;
    });

  if (!route) {
    throw new Error("selected_route_not_available");
  }

  return route;
}

function renderRouteOptions() {
  const select =
    getEl("routeId");

  if (!select) {
    return;
  }

  if (!availableRoutes.length) {
    select.disabled = true;
    select.innerHTML =
      `<option value="">No routes available</option>`;
    return;
  }

  select.disabled = false;

  select.innerHTML =
    availableRoutes
      .map((route) => {
        return `
          <option value="${escapeHtml(route.route_id)}">
            ${escapeHtml(route.label)}
          </option>
        `;
      })
      .join("");
}

function resolveFieldType(field = {}) {
  const type =
    normalizeString(field.type).toLowerCase();

  if (
    type === "email" ||
    type === "tel" ||
    type === "number"
  ) {
    return type;
  }

  return "text";
}

function renderDestinationFields() {
  const container =
    getEl("destinationFields");

  if (!container) {
    return;
  }

  if (!availableRoutes.length || !getSelectedRouteId()) {
    container.innerHTML = "";
    return;
  }

  const route =
    getSelectedRoute();

  const fields =
    route.required_destination_fields || [];

  container.innerHTML =
    fields
      .map((field) => {
        const name =
          normalizeString(field.name);

        if (!name) {
          return "";
        }

        return `
          <label class="field">
            <span>${escapeHtml(field.label || name)}</span>
            <input
              id="destination_${escapeHtml(name)}"
              name="${escapeHtml(name)}"
              type="${escapeHtml(resolveFieldType(field))}"
              ${field.required !== false ? "required" : ""}
            />
          </label>
        `;
      })
      .join("");
}

function lockEntryForm() {
  const routeSelect =
    getEl("routeId");

  if (routeSelect) {
    routeSelect.disabled = true;
  }

  getEl("destinationFields")
    ?.querySelectorAll("input, select, textarea")
    .forEach((el) => {
      el.disabled = true;
    });
}

function collectDestination(route = {}) {
  const destination = {};

  for (const field of route.required_destination_fields || []) {
    const name =
      normalizeString(field.name);

    if (!name) {
      continue;
    }

    const value =
      normalizeString(
        getEl(`destination_${name}`)?.value
      );

    if (field.required !== false && !value) {
      throw new Error(`destination_field_required_${name}`);
    }

    if (value) {
      destination[name] = value;
    }
  }

  if (
    route.destination_required !== false &&
    route.required_destination_fields?.length &&
    !Object.keys(destination).length
  ) {
    throw new Error("destination_required");
  }

  return destination;
}

function resolveSessionId(response = {}) {
  return (
    normalizeString(response.session_id) ||
    normalizeString(response.id) ||
    normalizeString(response.session?.id) ||
    null
  );
}

function resolveSettlementId(response = {}) {
  return (
    normalizeString(response.settlement_id) ||
    normalizeString(response.id) ||
    normalizeString(response.settlement?.id) ||
    null
  );
}

function renderQuoteValue(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return String(value);
}

export function renderQuote(container, {
  form,
  quote,
  selectedRoute
} = {}) {
  if (!container) {
    return;
  }

  const source =
    `${form.source_country} / ${form.source_rail}`;

  const destination =
    selectedRoute
      ? `${selectedRoute.receiver_country} / ${selectedRoute.payout_rail}`
      : form.receiver_country;

  const fundingAmount =
    renderQuoteValue(
      selectedRoute?.funding_amount ||
      quote?.requested_amount ||
      form.amount
    );

  const payoutAmount =
    renderQuoteValue(
      selectedRoute?.payout_amount ||
      quote?.payout_amount ||
      form.amount
    );

  container.innerHTML = `
    <div class="quote-header">
      <strong>Quote ready</strong>
      <span>Select a payout route and enter destination details.</span>
    </div>

    <div class="quote-grid">
      <div>
        <span>Source</span>
        <strong>${escapeHtml(source)}</strong>
      </div>

      <div>
        <span>Destination</span>
        <strong>${escapeHtml(destination)}</strong>
      </div>

      <div>
        <span>Funding amount</span>
        <strong>${escapeHtml(fundingAmount)}</strong>
      </div>

      <div>
        <span>Estimated payout</span>
        <strong>${escapeHtml(payoutAmount)}</strong>
      </div>
    </div>
  `;

  container.classList.remove("hidden");
}

export async function prepareBankTransferSettlement() {
  const form =
    readFiatContext();

  latestContext =
    form;

  const registered =
    await registerSession({
      source_country:
        form.source_country,

      receiver_country:
        form.receiver_country
    });

  const sessionId =
    resolveSessionId(registered);

  if (!sessionId) {
    throw new Error("session_id_missing");
  }

  const resolved =
    await resolveSession({
      session_id:
        sessionId
    });

  const quote =
    await quoteSession({
      session_id:
        sessionId,

      amount:
        form.amount
    });

  latestQuote =
    quote;

  availableRoutes =
    resolveRoutesPayload(quote);

  if (!availableRoutes.length) {
    throw new Error("no_enabled_bank_transfer_routes");
  }

  renderRouteOptions();
  renderDestinationFields();

  const selectedRoute =
    getSelectedRoute();

  return {
    form,

    session_id:
      sessionId,

    registered,

    resolved,

    quote,

    selected_route_id:
      selectedRoute.route_id,

    selected_route:
      selectedRoute
  };
}

export async function createSettlementFromPreparedQuote(prepared) {
  if (!prepared?.session_id) {
    throw new Error("missing_prepared_session");
  }

  if (!latestContext || !latestQuote) {
    throw new Error("missing_prepared_quote");
  }

  const route =
    getSelectedRoute();

  const destination =
    collectDestination(route);

  lockEntryForm();

  const settlement =
    await createSettlement({
      session_id:
        prepared.session_id,

      route_id:
        route.route_id,

      destination
    });

  const settlementId =
    resolveSettlementId(settlement);

  if (!settlementId) {
    throw new Error("settlement_id_missing");
  }

  return {
    settlement_id:
      settlementId,

    settlement,

    source_country:
      latestContext.source_country,

    source_rail:
      latestContext.source_rail
  };
}

getEl("routeId")?.addEventListener(
  "change",
  () => {
    renderDestinationFields();

    const quoteBox =
      getEl("quoteBox");

    if (
      quoteBox &&
      latestQuote &&
      latestContext &&
      availableRoutes.length
    ) {
      renderQuote(
        quoteBox,
        {
          form:
            latestContext,
          quote:
            latestQuote,
          selectedRoute:
            getSelectedRoute()
        }
      );
    }
  }
);
