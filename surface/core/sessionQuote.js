// unibrij/unibridge-landing/surface/core/sessionQuote.js

/*
--------------------------------------------------
Surface Session Quote

Purpose:
- keep session register / resolve / quote outside app.js
- validate basic quote inputs
- call backend session endpoints in order
- return raw backend quote/routes to app.js
- keep route picking in routePicker.js

Notes:
- This module does not pick routes.
- This module does not build destinations.
- This module does not create settlements.
- This module does not create funding sessions.
- This module does not touch Brazil / SmartPay.
--------------------------------------------------
*/

function normalizeString(value) {
  return String(value || "")
    .trim();
}

function normalizeCountry(value) {
  return normalizeString(value)
    .toUpperCase();
}

function normalizeAmount(value) {
  const amount =
    Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("invalid_amount");
  }

  return amount;
}

function getSessionId(response = {}) {
  return normalizeString(
    response.session_id ||
      response.sessionId ||
      response.id
  );
}

function getResolvedRouteId(response = {}) {
  return normalizeString(
    response.route_id ||
      response.routeId ||
      response.selected_route_id ||
      response.selectedRouteId
  ) || null;
}

function ensureRoutes(quote = {}) {
  const routes =
    Array.isArray(quote.routes)
      ? quote.routes
      : [];

  if (!routes.length) {
    throw new Error("no_routes");
  }

  return routes;
}

export async function registerSurfaceSession({
  apiPost,
  amount,
  sourceCountry,
  destinationCountry
} = {}) {
  if (typeof apiPost !== "function") {
    throw new Error("api_post_missing");
  }

  const normalizedAmount =
    normalizeAmount(amount);

  const normalizedSourceCountry =
    normalizeCountry(sourceCountry);

  const normalizedDestinationCountry =
    normalizeCountry(destinationCountry);

  if (!normalizedSourceCountry) {
    throw new Error("missing_source_country");
  }

  if (!normalizedDestinationCountry) {
    throw new Error("missing_destination_country");
  }

  const session =
    await apiPost("session/register", {
      amount:
        normalizedAmount,

      source_country:
        normalizedSourceCountry,

      receiver_country:
        normalizedDestinationCountry,

      destination_country:
        normalizedDestinationCountry
    });

  const sessionId =
    getSessionId(session);

  if (!sessionId) {
    throw new Error("missing_session_id");
  }

  return {
    session,
    sessionId,
    amount:
      normalizedAmount,

    sourceCountry:
      normalizedSourceCountry,

    destinationCountry:
      normalizedDestinationCountry
  };
}

export async function resolveSurfaceSession({
  apiPost,
  sessionId
} = {}) {
  if (typeof apiPost !== "function") {
    throw new Error("api_post_missing");
  }

  if (!sessionId) {
    throw new Error("missing_session_id");
  }

  const resolved =
    await apiPost("session/resolve", {
      session_id:
        sessionId
    });

  return {
    resolved,
    routeId:
      getResolvedRouteId(resolved)
  };
}

export async function quoteSurfaceSession({
  apiPost,
  sessionId
} = {}) {
  if (typeof apiPost !== "function") {
    throw new Error("api_post_missing");
  }

  if (!sessionId) {
    throw new Error("missing_session_id");
  }

  const quote =
    await apiPost("session/quote", {
      session_id:
        sessionId
    });

  const routes =
    ensureRoutes(quote);

  return {
    quote,
    routes
  };
}

export async function prepareSurfaceQuote({
  apiPost,
  amount,
  sourceCountry,
  destinationCountry
} = {}) {
  const registered =
    await registerSurfaceSession({
      apiPost,
      amount,
      sourceCountry,
      destinationCountry
    });

  const resolved =
    await resolveSurfaceSession({
      apiPost,
      sessionId:
        registered.sessionId
    });

  const quoted =
    await quoteSurfaceSession({
      apiPost,
      sessionId:
        registered.sessionId
    });

  return {
    session:
      registered.session,

    sessionId:
      registered.sessionId,

    amount:
      registered.amount,

    sourceCountry:
      registered.sourceCountry,

    destinationCountry:
      registered.destinationCountry,

    resolved:
      resolved.resolved,

    resolvedRouteId:
      resolved.routeId,

    quote:
      quoted.quote,

    routes:
      quoted.routes
  };
}

export {
  getSessionId,
  getResolvedRouteId,
  ensureRoutes
};
