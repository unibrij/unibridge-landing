// fiat/bank-transfer/js/entryForm.js

import {
  createSettlement,
  quoteSession,
  registerSession,
  resolveSession
} from "./sessionApi.js";

import {
  readFiatContext,
  renderContextSummary
} from "./fiatContext.js";

import {
  resolveRoutesPayload
} from "./routeResolver.js";

import {
  collectDestination,
  renderDestinationFields
} from "./destinationFields.js";

import {
  hasProviderDestination
} from "./providerDestinationRegistry.js";

import {
  formatRouteLimitMessage,
  isRouteAmountAvailable,
  selectFirstAvailableRoute
} from "../../../shared/pricing/index.js";

export {
  renderQuote
} from "./quoteRenderer.js";

import {
  renderQuote
} from "./quoteRenderer.js";

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

function getEl(id) {
  return document.getElementById(id);
}

function getRouteFieldContainer() {
  const routeSelect =
    getEl("routeId");

  return (
    routeSelect?.closest(".route-grid") ||
    routeSelect?.closest(".field") ||
    routeSelect?.parentElement ||
    null
  );
}

function hideQuoteStageFields() {
  getRouteFieldContainer()
    ?.classList.add("hidden");

  getEl("destinationFields")
    ?.classList.add("hidden");

  getEl("quoteBox")
    ?.classList.add("hidden");
}

function showQuoteStageFields() {
  getRouteFieldContainer()
    ?.classList.remove("hidden");

  getEl("destinationFields")
    ?.classList.remove("hidden");

  getEl("quoteBox")
    ?.classList.remove("hidden");
}

function showRouteFieldOnly() {
  getRouteFieldContainer()
    ?.classList.remove("hidden");

  getEl("destinationFields")
    ?.classList.add("hidden");

  getEl("quoteBox")
    ?.classList.add("hidden");
}

export async function loadBankTransferRoutes() {
  latestContext =
    renderContextSummary();

  availableRoutes = [];
  latestQuote = null;

  hideQuoteStageFields();

  const select =
    getEl("routeId");

  if (select) {
    select.disabled = true;
    select.innerHTML = "";
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
    availableRoutes.find(
      item =>
        item.route_id ===
        selectedRouteId
    );

  if (!route) {
    throw new Error(
      "selected_route_not_available"
    );
  }

  if (
    !isRouteAmountAvailable(
      route
    )
  ) {
    throw new Error(
      formatRouteLimitMessage(
        route
      ) ||
      "selected_route_amount_not_available"
    );
  }

  return route;
}

/*
--------------------------------------------------
Route options
--------------------------------------------------

Route amount availability is fully backend-driven.

No executor, provider, country, rail, or currency-specific
limit logic belongs here.

Routes outside their current amount limits remain visible
but disabled.

The first backend-ordered amount-available Route is selected
automatically.
--------------------------------------------------
*/

function renderRouteOptions() {
  const select =
    getEl("routeId");

  if (!select) {
    return null;
  }

  if (!availableRoutes.length) {
    select.disabled = true;

    select.innerHTML =
      `<option value="">No routes available</option>`;

    return null;
  }

  const selectedRoute =
    selectFirstAvailableRoute(
      availableRoutes
    );

  select.innerHTML =
    availableRoutes
      .map(
        route => {
          const available =
            isRouteAmountAvailable(
              route
            );

          const limitMessage =
            available
              ? null
              : formatRouteLimitMessage(
                  route
                );

          const label =
            limitMessage
              ? `${route.label} — ${limitMessage}`
              : route.label;

          const isSelected =
            selectedRoute
              ?.route_id ===
            route.route_id;

          return `
            <option
              value="${escapeHtml(route.route_id)}"
              ${available ? "" : "disabled"}
              ${isSelected ? "selected" : ""}
            >
              ${escapeHtml(label)}
            </option>
          `;
        }
      )
      .join("");

  select.disabled =
    !selectedRoute;

  return selectedRoute;
}

function resolveNoAvailableRouteMessage() {
  const limitedRoute =
    availableRoutes.find(
      route =>
        !isRouteAmountAvailable(
          route
        )
    );

  if (!limitedRoute) {
    return null;
  }

  return formatRouteLimitMessage(
    limitedRoute
  );
}

function renderSelectedDestinationFields() {
  renderDestinationFields({
    availableRoutes,

    selectedRouteId:
      getSelectedRouteId(),

    getSelectedRoute
  });
}

function renderSelectedQuote() {
  const quoteBox =
    getEl("quoteBox");

  if (
    !quoteBox ||
    !latestQuote ||
    !latestContext ||
    !availableRoutes.length
  ) {
    return;
  }

  const selectedRoute =
    getSelectedRoute();

  renderQuote(
    quoteBox,
    {
      form:
        latestContext,

      quote:
        latestQuote,

      selectedRoute
    }
  );
}

function lockEntryForm() {
  const routeSelect =
    getEl("routeId");

  if (routeSelect) {
    routeSelect.disabled = true;
  }

  getEl("destinationFields")
    ?.querySelectorAll(
      "input, select, textarea"
    )
    .forEach(
      el => {
        el.disabled = true;
      }
    );
}

function resolveSessionId(
  response = {}
) {
  return (
    normalizeString(
      response.session_id
    ) ||
    normalizeString(
      response.id
    ) ||
    normalizeString(
      response.session?.id
    ) ||
    null
  );
}

function resolveSettlementId(
  response = {}
) {
  return (
    normalizeString(
      response.settlement_id
    ) ||
    normalizeString(
      response.id
    ) ||
    normalizeString(
      response.settlement?.id
    ) ||
    null
  );
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
    resolveSessionId(
      registered
    );

  if (!sessionId) {
    throw new Error(
      "session_id_missing"
    );
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
    throw new Error(
      "no_enabled_bank_transfer_routes"
    );
  }

  const selectedRoute =
    renderRouteOptions();

  if (!selectedRoute) {
    showRouteFieldOnly();

    throw new Error(
      resolveNoAvailableRouteMessage() ||
      "no_routes_available_for_amount"
    );
  }

  if (
    !selectedRoute
      .required_destination_fields
      ?.length &&
    !hasProviderDestination(
      selectedRoute
    )
  ) {
    hideQuoteStageFields();

    throw new Error(
      "route_destination_fields_missing"
    );
  }

  renderSelectedDestinationFields();

  showQuoteStageFields();

  renderSelectedQuote();

  return {
    form,

    session_id:
      sessionId,

    registered,

    resolved,

    quote,

    routes:
      availableRoutes,

    selected_route_id:
      selectedRoute.route_id,

    selected_route:
      selectedRoute
  };
}

export async function createSettlementFromPreparedQuote(
  prepared
) {
  if (!prepared?.session_id) {
    throw new Error(
      "missing_prepared_session"
    );
  }

  if (
    !latestContext ||
    !latestQuote
  ) {
    throw new Error(
      "missing_prepared_quote"
    );
  }

  const route =
    getSelectedRoute();

  const destination =
    collectDestination(
      route
    );

  const settlement =
    await createSettlement({
      session_id:
        prepared.session_id,

      route_id:
        route.route_id,

      destination
    });

  lockEntryForm();

  const settlementId =
    resolveSettlementId(
      settlement
    );

  if (!settlementId) {
    throw new Error(
      "settlement_id_missing"
    );
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

getEl("routeId")
  ?.addEventListener(
    "change",
    () => {
      renderSelectedDestinationFields();
      renderSelectedQuote();
    }
  );
