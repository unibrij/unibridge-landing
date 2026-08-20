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
  formatRouteLimitMessage,
  selectFirstAvailableRoute
} from "/shared/pricing/index.js";

import {
  normalizeString
} from "./normalization.js";


export function selectDefaultRoute(
  routes = []
) {
  if (
    !Array.isArray(routes) ||
    routes.length === 0
  ) {
    return null;
  }

  return selectFirstAvailableRoute(
    routes
  );
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


function resolveNoAvailableRouteMessage(
  routes = []
) {
  if (!Array.isArray(routes)) {
    return null;
  }

  for (const route of routes) {
    const message =
      formatRouteLimitMessage(
        route
      );

    if (message) {
      return message;
    }
  }

  return null;
}


export async function preparePaymentReview({
  sourceCountry,
  receiverCountry,
  amount,
  phoneNumber,
  currency
}) {
  const registered =
    await registerPayByBankSession({
      source_country:
        sourceCountry,

      receiver_country:
        receiverCountry,

      phone_number:
        phoneNumber
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
    !Array.isArray(routes) ||
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

  if (!selectedRoute) {
    throw new Error(
      resolveNoAvailableRouteMessage(
        routes
      ) ||
      "no_routes_available_for_amount"
    );
  }

  if (!selectedRoute.route_id) {
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
