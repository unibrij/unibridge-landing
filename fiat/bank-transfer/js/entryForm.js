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

function resolveRouteChoice(value) {
  const route =
    normalizeString(value).toLowerCase();

  if (route === "brl_pix") {
    return {
      receiver_country: "BR",
      expected_payout_rail: "pix"
    };
  }

  if (route === "php_instapay") {
    return {
      receiver_country: "PH",
      expected_payout_rail: "instapay"
    };
  }

  if (route === "ngn_bank") {
    return {
      receiver_country: "NG",
      expected_payout_rail: "bank_transfer"
    };
  }

  throw new Error("unsupported_destination_route");
}

function pickRoute(quote = {}, form = {}) {
  const routes =
    Array.isArray(quote.routes)
      ? quote.routes
      : [];

  if (!routes.length) {
    throw new Error("no_routes");
  }

  const expectedRail =
    normalizeString(
      form.expected_payout_rail
    ).toLowerCase();

  const matched =
    routes.find((route) => {
      const rail =
        normalizeString(
          route.payout_rail
        ).toLowerCase();

      return expectedRail && rail === expectedRail;
    }) || routes[0];

  const routeId =
    normalizeString(
      matched.route_id ||
      matched.id
    );

  if (!routeId) {
    throw new Error("quote_route_id_missing");
  }

  return {
    route_id:
      routeId,
    route:
      matched
  };
}

function buildBrazilDestination() {
  const pix =
    normalizeString(
      getEl("pix")?.value
    );

  const taxId =
    normalizeString(
      getEl("taxId")?.value
    );

  if (!pix) {
    throw new Error("PIX_required");
  }

  return taxId
    ? {
        pix,
        tax_id:
          taxId
      }
    : {
        pix
      };
}

function buildDestination(form = {}) {
  if (form.receiver_country === "BR") {
    return buildBrazilDestination();
  }

  throw new Error("destination_form_not_ready_for_selected_route");
}

export function readEntryForm() {
  const sourceCountry =
    normalizeString(
      getEl("sourceCountry")?.value
    );

  const routeChoice =
    resolveRouteChoice(
      getEl("routeId")?.value
    );

  const amount =
    normalizeAmount(
      getEl("amount")?.value
    );

  const email =
    normalizeString(
      getEl("email")?.value
    );

  const phone =
    normalizeString(
      getEl("phone")?.value
    );

  const rail =
    resolveSourceRail(
      sourceCountry
    );

  return {
    amount,

    email:
      email || null,

    phone:
      phone || null,

    source_country:
      rail.source_country,

    source_rail:
      rail.source_rail,

    receiver_country:
      routeChoice.receiver_country,

    expected_payout_rail:
      routeChoice.expected_payout_rail
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

  const destination =
    buildDestination(
      prepared.form
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
      prepared.form?.source_rail,
    email:
      prepared.form?.email,
    phone:
      prepared.form?.phone
  };
}
