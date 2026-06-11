// unibrij/unibridge-landing/surface/core/quoteState.js

/*
--------------------------------------------------
Surface Quote State

Purpose:
- keep quote normalization outside app.js
- build the local currentRouteQuote object
- render execution quote through existing ui-helpers.js
- avoid route/payment/provider decisions here

Notes:
- This module does not pick routes.
- This module does not touch SmartPay / Brazil.
- It only formats selected route quote data.
--------------------------------------------------
*/

import {
  renderExecutionQuote
} from "../ui-helpers.js";

function normalizeNumber(value, fallback = null) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

export function buildCurrentRouteQuote({
  quote,
  selectedRoute,
  requestedAmount
} = {}) {
  if (!selectedRoute) {
    throw new Error("missing_selected_route");
  }

  return {
    requested_amount:
      quote?.requested_amount ??
      requestedAmount,

    payout_amount:
      selectedRoute.payout_amount ?? null,

    funding_amount:
      selectedRoute.funding_amount ?? null,

    executor_fee:
      normalizeNumber(
        selectedRoute.executor_fee,
        0
      )
  };
}

export function renderCurrentRouteQuote({
  currentRouteQuote,
  countryLabel,
  setStatus
} = {}) {
  if (!currentRouteQuote) {
    throw new Error("missing_current_route_quote");
  }

  return renderExecutionQuote({
    requestedAmount:
      currentRouteQuote.requested_amount,

    countryLabel,

    executorFee:
      currentRouteQuote.executor_fee,

    setStatus
  });
}

export function buildAndRenderCurrentRouteQuote({
  quote,
  selectedRoute,
  requestedAmount,
  countryLabel,
  setStatus
} = {}) {
  const currentRouteQuote =
    buildCurrentRouteQuote({
      quote,
      selectedRoute,
      requestedAmount
    });

  renderCurrentRouteQuote({
    currentRouteQuote,
    countryLabel,
    setStatus
  });

  return currentRouteQuote;
}
