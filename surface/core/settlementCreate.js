// unibrij/unibridge-landing/surface/core/settlementCreate.js

/*
--------------------------------------------------
Surface Settlement Create

Purpose:
- keep settlement creation outside app.js
- validate required runtime state before create
- call backend settlement/create endpoint
- extract settlement_id from backend response
- persist settlement through callback

Notes:
- This module does not pick routes.
- This module does not build destinations.
- This module does not create funding sessions.
- This module does not touch Brazil / SmartPay.
--------------------------------------------------
*/

function normalizeString(value) {
  return String(value || "")
    .trim();
}

function getSettlementId(response = {}) {
  return normalizeString(
    response.settlement_id ||
      response.settlementId ||
      response.id
  );
}

function normalizeAmount(value) {
  const amount =
    Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("invalid_amount");
  }

  return amount;
}

export async function createSurfaceSettlement({
  apiPost,
  sessionId,
  routeId,
  destination,
  currentRouteQuote,
  requestedAmount,
  persistSettlement
} = {}) {
  if (typeof apiPost !== "function") {
    throw new Error("api_post_missing");
  }

  if (!sessionId) {
    throw new Error("missing_session_id");
  }

  if (!routeId) {
    throw new Error("missing_route_id");
  }

  if (!destination || typeof destination !== "object") {
    throw new Error("missing_destination");
  }

  const amount =
    normalizeAmount(
      currentRouteQuote?.requested_amount ??
        requestedAmount
    );

  const settlement =
    await apiPost("settlement/create", {
      session_id:
        sessionId,

      route_id:
        routeId,

      amount,

      destination,

      quote:
        currentRouteQuote || null
    });

  const settlementId =
    getSettlementId(settlement);

  if (!settlementId) {
    throw new Error("missing_settlement_id");
  }

  if (typeof persistSettlement === "function") {
    persistSettlement(settlementId);
  }

  return {
    settlement,
    settlementId
  };
}

export {
  getSettlementId
};
