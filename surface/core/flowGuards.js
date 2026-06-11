// unibrij/unibridge-landing/surface/core/flowGuards.js

/*
--------------------------------------------------
Surface Flow Guards

Purpose:
- keep runtime flow validation outside app.js
- validate session / route / quote before continue
- validate destination before settlement create
- keep error names stable and explicit

Notes:
- This module does not call APIs.
- This module does not pick routes.
- This module does not build destinations.
- This module does not touch Brazil / SmartPay.
--------------------------------------------------
*/

function isObject(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value)
  );
}

function normalizeString(value) {
  return String(value || "")
    .trim();
}

function normalizeAmount(value) {
  const amount =
    Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("invalid_amount");
  }

  return amount;
}

export function ensureSessionId(sessionId) {
  const value =
    normalizeString(sessionId);

  if (!value) {
    throw new Error("missing_session_id");
  }

  return value;
}

export function ensureRouteId(routeId) {
  const value =
    normalizeString(routeId);

  if (!value) {
    throw new Error("missing_route_id");
  }

  return value;
}

export function ensureCurrentRouteQuote(currentRouteQuote) {
  if (!isObject(currentRouteQuote)) {
    throw new Error("missing_quote");
  }

  normalizeAmount(
    currentRouteQuote.requested_amount
  );

  return currentRouteQuote;
}

export function ensureDestination(destination) {
  if (!isObject(destination)) {
    throw new Error("missing_destination");
  }

  return destination;
}

export function ensureFlowCanContinue({
  sessionId,
  routeId,
  currentRouteQuote
} = {}) {
  return {
    sessionId:
      ensureSessionId(sessionId),

    routeId:
      ensureRouteId(routeId),

    currentRouteQuote:
      ensureCurrentRouteQuote(currentRouteQuote)
  };
}

export function ensureSettlementCreateInputs({
  sessionId,
  routeId,
  currentRouteQuote,
  destination
} = {}) {
  return {
    ...ensureFlowCanContinue({
      sessionId,
      routeId,
      currentRouteQuote
    }),

    destination:
      ensureDestination(destination)
  };
}
