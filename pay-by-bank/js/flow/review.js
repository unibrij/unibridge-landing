// pay-by-bank/js/flow/review.js

import {
  registerPayByBankSession,
  resolveSession,
  quoteSession,
  extractSessionId
} from "../api.js";

import {
  resolveRoutesPayload
} from "/fiat/bank-transfer/js/routeResolver.js";

import {
  normalizeString
} from "./normalization.js";


export function selectDefaultRoute(
  routes = []
) {
  if (
    !Array.isArray(
      routes
    ) ||
    routes.length === 0
  ) {
    return null;
  }

  return routes[0] || null;
}


export function resolveRouteMethodLabel(
  route = {}
) {
  return (
    normalizeString(
      route.label
    ) ||
    normalizeString(
      route.payout_rail
    ) ||
    normalizeString(
      route.rail
    ) ||
    "Bank transfer"
  );
}


export async function preparePaymentReview({
  sourceCountry,
  receiverCountry,
  amount,
  currency
}) {
  const registered =
    await registerPayByBankSession({
      source_country:
        sourceCountry,

      receiver_country:
        receiverCountry
    });

  const sessionId =
    extractSessionId(
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

      amount
    });

  const routeContext = {
    source_country:
      sourceCountry,

    receiver_country:
      receiverCountry,

    amount,

    source_currency:
      currency,

    source_rail:
      "bank_transfer"
  };

  const routes =
    resolveRoutesPayload(
      quote,
      resolved,
      routeContext
    );

  if (
    !Array.isArray(
      routes
    ) ||
    routes.length === 0
  ) {
    throw new Error(
      "no_enabled_pay_by_bank_routes"
    );
  }

  const selectedRoute =
    selectDefaultRoute(
      routes
    );

  if (
    !selectedRoute?.route_id
  ) {
    throw new Error(
      "selected_route_missing"
    );
  }

  return {
    sessionId,
    resolved,
    quote,
    routes,
    selectedRoute
  };
}
