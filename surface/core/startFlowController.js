// unibrij/unibridge-landing/surface/core/startFlowController.js

/*
--------------------------------------------------
Surface Start Flow Controller

Purpose:
- keep startFlow orchestration outside app.js
- validate/get amount through callback
- prepare session/register + resolve + quote through callback
- select route through callback
- build/render quote through callback
- persist runtime state through callbacks
- lock entry fields through callback

Notes:
- This module does not know Brazil / SmartPay.
- This module does not build destinations.
- This module does not create settlements.
- This module does not create funding sessions.
- This module delegates all route selection to routePicker.
--------------------------------------------------
*/

function call(fn, ...args) {
  if (typeof fn !== "function") {
    return null;
  }

  return fn(...args);
}

function requireFunction(fn, name) {
  if (typeof fn !== "function") {
    throw new Error(`${name}_missing`);
  }

  return fn;
}

function requireValue(value, name) {
  if (!value) {
    throw new Error(`${name}_missing`);
  }

  return value;
}

export async function startSurfaceFlow({
  apiPost,

  getAmount,
  getSourceCountryCode,
  getDestinationCountryCode,

  prepareSurfaceQuote,
  pickSelectedRoute,
  getRouteId,
  buildAndRenderCurrentRouteQuote,

  getCountryLabel,

  setSessionId,
  setRouteId,
  setCurrentRouteQuote,

  setStatus,
  setContinueButtonMode,
  setContinueButtonsDisabled,
  lockEntryFields,
  refreshAmountLimitUi,
  emit
} = {}) {
  requireFunction(apiPost, "api_post");
  requireFunction(getAmount, "get_amount");
  requireFunction(getSourceCountryCode, "get_source_country");
  requireFunction(getDestinationCountryCode, "get_destination_country");
  requireFunction(prepareSurfaceQuote, "prepare_surface_quote");
  requireFunction(pickSelectedRoute, "pick_selected_route");
  requireFunction(getRouteId, "get_route_id");
  requireFunction(buildAndRenderCurrentRouteQuote, "build_route_quote");

  call(
    setStatus,
    "Preparing quote...",
    "info"
  );

  call(
    setContinueButtonsDisabled,
    true
  );

  const amount =
    getAmount();

  const sourceCountry =
    getSourceCountryCode();

  const destinationCountry =
    getDestinationCountryCode();

  const prepared =
    await prepareSurfaceQuote({
      apiPost,
      amount,
      sourceCountry,
      destinationCountry
    });

  const sessionId =
    requireValue(
      prepared.sessionId,
      "session_id"
    );

  call(
    setSessionId,
    sessionId
  );

  const quote =
    requireValue(
      prepared.quote,
      "quote"
    );

  const selectedRoute =
    pickSelectedRoute({
      routes:
        prepared.routes || quote.routes,

      destinationCountry
    });

  const routeId =
    requireValue(
      getRouteId(selectedRoute),
      "route_id"
    );

  call(
    setRouteId,
    routeId
  );

  const currentRouteQuote =
    buildAndRenderCurrentRouteQuote({
      quote,
      selectedRoute,

      requestedAmount:
        amount,

      countryLabel:
        typeof getCountryLabel === "function"
          ? getCountryLabel()
          : destinationCountry,

      setStatus
    });

  call(
    setCurrentRouteQuote,
    currentRouteQuote
  );

  call(lockEntryFields);

  call(
    setContinueButtonMode,
    "prepare_payment"
  );

  call(
    setContinueButtonsDisabled,
    false
  );

  call(refreshAmountLimitUi);

  call(
    emit,
    "unibridge:quote-ready"
  );

  return {
    sessionId,
    routeId,
    quote,
    selectedRoute,
    currentRouteQuote
  };
}
