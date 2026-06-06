// fiat/bank-transfer/js/entryForm.js

import {
  resolveSourceRail
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

function readFiatContext() {
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

function normalizeField(field = {}, fallbackName = "") {
  const name =
    normalizeString(
      field.name ||
      field.key ||
      field.id ||
      fallbackName
    );

  if (!name) {
    return null;
  }

  return {
    name,

    label:
      normalizeString(field.label) ||
      normalizeString(field.title) ||
      name,

    type:
      normalizeString(field.type) ||
      "text",

    required:
      field.required !== false
  };
}

function normalizeFieldsFromCandidate(candidate) {
  if (!candidate) {
    return [];
  }

  if (Array.isArray(candidate)) {
    return candidate
      .map((field) => {
        return normalizeField(field);
      })
      .filter(Boolean);
  }

  if (
    typeof candidate === "object" &&
    Array.isArray(candidate.fields)
  ) {
    return candidate.fields
      .map((field) => {
        return normalizeField(field);
      })
      .filter(Boolean);
  }

  if (
    typeof candidate === "object" &&
    candidate.properties &&
    typeof candidate.properties === "object"
  ) {
    return Object.entries(candidate.properties)
      .map(([name, field]) => {
        const required =
          Array.isArray(candidate.required)
            ? candidate.required.includes(name)
            : field?.required;

        return normalizeField(
          {
            ...field,
            required
          },
          name
        );
      })
      .filter(Boolean);
  }

  if (typeof candidate === "object") {
    return Object.entries(candidate)
      .filter(([, value]) => {
        return (
          value &&
          typeof value === "object" &&
          !Array.isArray(value)
        );
      })
      .map(([name, field]) => {
        return normalizeField(field, name);
      })
      .filter(Boolean);
  }

  return [];
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
    const fields =
      normalizeFieldsFromCandidate(candidate);

    if (fields.length) {
      return fields;
    }
  }

  return [];
}

function resolveRouteCountry(route = {}, context = {}) {
  return normalizeString(
    route.receiver_country ||
    route.destination_country ||
    route.destination?.country ||
    route.country ||
    context.receiver_country
  ).toUpperCase();
}

function resolveRouteRail(route = {}) {
  return normalizeString(
    route.payout_rail ||
    route.expected_payout_rail ||
    route.destination_rail ||
    route.destination?.rail ||
    route.rail
  ).toLowerCase();
}

function resolveExecutionOptions(resolved = {}, route = {}) {
  const execution =
    resolved?.delivery_options?.execution ||
    resolved?.execution ||
    {};

  const payoutRail =
    resolveRouteRail(route);

  if (Array.isArray(execution)) {
    return execution;
  }

  if (execution && typeof execution === "object") {
    const direct =
      execution[payoutRail];

    if (Array.isArray(direct)) {
      return direct;
    }

    if (direct && typeof direct === "object") {
      return [direct];
    }

    const matchingKey =
      Object.keys(execution).find((key) => {
        return key.toLowerCase() === payoutRail;
      });

    if (matchingKey) {
      const value =
        execution[matchingKey];

      if (Array.isArray(value)) {
        return value;
      }

      if (value && typeof value === "object") {
        return [value];
      }
    }
  }

  return Object.values(execution)
    .flatMap((value) => {
      if (Array.isArray(value)) {
        return value;
      }

      if (
        value &&
        typeof value === "object"
      ) {
        return [value];
      }

      return [];
    });
}

function resolveInstructionSchemaFromResolved(route = {}, resolved = {}) {
  const options =
    resolveExecutionOptions(
      resolved,
      route
    );

  const routeId =
    normalizeString(
      route.route_id ||
      route.id
    );

  const executor =
    normalizeString(
      route.executor ||
      route.execution_provider ||
      route.provider
    ).toLowerCase();

  const matched =
    options.find((option) => {
      return (
        routeId &&
        normalizeString(
          option.route_id ||
          option.id
        ) === routeId
      );
    }) ||
    options.find((option) => {
      if (!executor) {
        return false;
      }

      return [
        option.executor,
        option.execution_provider,
        option.provider,
        option.sender
      ]
        .map((value) => {
          return normalizeString(value).toLowerCase();
        })
        .includes(executor);
    }) ||
    options[0];

  return (
    matched?.instruction_schema ||
    matched?.destination_schema ||
    matched?.required_destination_fields ||
    matched?.destination_fields ||
    matched?.schema ||
    null
  );
}

function formatRouteLabel(route = {}) {
  const receiverCountry =
    resolveRouteCountry(route);

  const payoutRail =
    resolveRouteRail(route);

  if (
    receiverCountry === "BR" &&
    payoutRail === "pix"
  ) {
    return "Brazil · PIX";
  }

  if (receiverCountry === "BR") {
    return payoutRail
      ? `Brazil · ${payoutRail.toUpperCase()}`
      : "Brazil";
  }

  if (receiverCountry === "PH") {
    return payoutRail
      ? `Philippines · ${payoutRail.toUpperCase()}`
      : "Philippines";
  }

  if (receiverCountry && payoutRail) {
    return `${receiverCountry} · ${payoutRail.toUpperCase()}`;
  }

  if (receiverCountry) {
    return receiverCountry;
  }

  if (payoutRail) {
    return payoutRail.toUpperCase();
  }

  return "Payout route";
}

function normalizeRoute(route = {}, resolved = {}, context = {}) {
  const routeId =
    normalizeString(
      route.route_id ||
      route.id
    );

  if (!routeId) {
    return null;
  }

  const instructionSchema =
    resolveInstructionSchemaFromResolved(
      route,
      resolved
    );

  const enrichedRoute = {
    ...route,

    instruction_schema:
      route.instruction_schema ||
      instructionSchema
  };

  const receiverCountry =
    resolveRouteCountry(
      enrichedRoute,
      context
    );

  const payoutRail =
    resolveRouteRail(
      enrichedRoute
    );

  const normalizedRoute = {
    ...enrichedRoute,

    route_id:
      routeId,

    receiver_country:
      receiverCountry,

    payout_rail:
      payoutRail
  };

  return {
    ...normalizedRoute,

    label:
      normalizeString(route.label) ||
      normalizeString(route.name) ||
      normalizeString(route.display_name) ||
      formatRouteLabel(normalizedRoute),

    required_destination_fields:
      resolveRouteFields(normalizedRoute)
  };
}

function resolveRoutesPayload(payload = {}, resolved = {}, context = {}) {
  const rawRoutes =
    Array.isArray(payload.routes)
      ? payload.routes
      : Array.isArray(payload.data)
        ? payload.data
        : [];

  return rawRoutes
    .map((route) => {
      return normalizeRoute(
        route,
        resolved,
        context
      );
    })
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
      ? selectedRoute.label
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
    resolveRoutesPayload(
      quote,
      resolved,
      form
    );

  if (!availableRoutes.length) {
    throw new Error("no_enabled_bank_transfer_routes");
  }

  renderRouteOptions();
  renderDestinationFields();

  const selectedRoute =
    getSelectedRoute();

  if (!selectedRoute.required_destination_fields?.length) {
    throw new Error("route_destination_fields_missing");
  }

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
