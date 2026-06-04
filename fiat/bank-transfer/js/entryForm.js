// fiat/bank-transfer/js/entryForm.js

import {
  getDefaultSourceRail
} from "./config.js";

import {
  createSettlement,
  listBankTransferRoutes,
  quoteSession,
  registerSession,
  resolveSession
} from "./sessionApi.js";

let availableRoutes =
  [];

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
      Array.isArray(route.required_destination_fields)
        ? route.required_destination_fields
        : []
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
    .filter(Boolean);
}

export async function loadBankTransferRoutes() {
  const payload =
    await listBankTransferRoutes();

  availableRoutes =
    resolveRoutesPayload(payload)
      .filter((route) => route.enabled !== false);

  if (!availableRoutes.length) {
    throw new Error("no_enabled_bank_transfer_routes");
  }

  renderRouteOptions();

  renderDestinationFields();

  return availableRoutes;
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

function getPreparedRoute(routeId) {
  const normalizedRouteId =
    normalizeString(routeId);

  const route =
    availableRoutes.find((item) => {
      return item.route_id === normalizedRouteId;
    });

  if (!route) {
    throw new Error("prepared_route_not_available");
  }

  return route;
}

function renderRouteOptions() {
  const select =
    getEl("routeId");

  if (!select) {
    return;
  }

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

        const label =
          normalizeString(field.label) ||
          name;

        const required =
          field.required !== false;

        return `
          <label>
            <span>${escapeHtml(label)}</span>
            <input
              id="destination_${escapeHtml(name)}"
              name="${escapeHtml(name)}"
              type="${escapeHtml(resolveFieldType(field))}"
              ${required ? "required" : ""}
            />
          </label>
        `;
      })
      .join("");
}

function lockEntryForm() {
  [
    "routeId",
    "sourceCountry",
    "amount"
  ].forEach((id) => {
    const el =
      getEl(id);

    if (el) {
      el.disabled = true;
    }
  });

  getEl("destinationFields")
    ?.querySelectorAll("input, select, textarea")
    .forEach((el) => {
      el.disabled = true;
    });
}

function collectDestination(route = {}) {
  const destination =
    {};

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
      destination[name] =
        value;
    }
  }

  if (
    route.destination_required !== false &&
    !Object.keys(destination).length
  ) {
    throw new Error("destination_required");
  }

  return destination;
}

export function readEntryForm() {
  const sourceCountry =
    normalizeString(
      getEl("sourceCountry")?.value
    );

  const amount =
    normalizeAmount(
      getEl("amount")?.value
    );

  const rail =
    resolveSourceRail(
      sourceCountry
    );

  const route =
    getSelectedRoute();

  return {
    amount,

    route_id:
      route.route_id,

    source_country:
      rail.source_country,

    source_rail:
      rail.source_rail,

    receiver_country:
      route.receiver_country,

    expected_payout_rail:
      route.payout_rail
  };
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

function pickRoute(quote = {}, form = {}) {
  const routes =
    Array.isArray(quote.routes)
      ? quote.routes
      : [];

  const matched =
    routes.find((route) => {
      const routeId =
        normalizeString(
          route.route_id ||
          route.id
        );

      return routeId === form.route_id;
    });

  if (!matched) {
    throw new Error("quoted_route_not_available");
  }

  return {
    route_id:
      form.route_id,
    route:
      matched
  };
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
    `${form.receiver_country} / ${form.expected_payout_rail}`;

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
      <span>Review before creating the payout route.</span>
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
  if (!availableRoutes.length) {
    await loadBankTransferRoutes();
  }

  const form =
    readEntryForm();

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

  const selected =
    pickRoute(
      quote,
      form
    );

  lockEntryForm();

  return {
    form,

    session_id:
      sessionId,

    registered,

    resolved,

    quote,

    selected_route_id:
      selected.route_id,

    selected_route:
      selected.route
  };
}

export async function createSettlementFromPreparedQuote(prepared) {
  if (!prepared?.session_id) {
    throw new Error("missing_prepared_session");
  }

  if (!prepared?.selected_route_id) {
    throw new Error("missing_selected_route");
  }

  if (getSelectedRouteId() !== prepared.selected_route_id) {
    throw new Error("selected_route_changed_after_quote");
  }

  const route =
    getPreparedRoute(
      prepared.selected_route_id
    );

  const destination =
    collectDestination(
      route
    );

  const settlement =
    await createSettlement({
      session_id:
        prepared.session_id,

      route_id:
        prepared.selected_route_id,

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
      prepared.form?.source_country,

    source_rail:
      prepared.form?.source_rail
  };
}

getEl("routeId")?.addEventListener(
  "change",
  renderDestinationFields
);
