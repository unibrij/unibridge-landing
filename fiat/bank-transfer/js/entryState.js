// fiat/bank-transfer/js/entryState.js

const initialState = {
  context: null,
  session_id: null,
  registered: null,
  resolved: null,
  quote: null,
  routes: [],
  selected_route_id: "",
  selected_route: null,
  prepared_quote: null
};

let state = {
  ...initialState,
  routes: []
};

function clone(value) {
  return JSON.parse(
    JSON.stringify(value ?? null)
  );
}

function normalizeString(value) {
  return String(value || "").trim();
}

function isObject(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function pickSelectedRoute({
  routes,
  selectedRouteId,
  selectedRoute
} = {}) {
  if (selectedRoute?.route_id) {
    return selectedRoute;
  }

  return routes.find((route) => {
    return route?.route_id === selectedRouteId;
  }) || null;
}

function isValidPreparedQuote(prepared = {}) {
  return Boolean(
    isObject(prepared) &&
    normalizeString(prepared.session_id) &&
    prepared.quote &&
    prepared.selected_route?.route_id
  );
}

export function getEntryState() {
  return clone(state);
}

export function setEntryContext(context) {
  invalidatePreparedQuote();

  state.context =
    context || null;

  return getEntryState();
}

export function setPreparedQuote(prepared = {}) {
  if (!isValidPreparedQuote(prepared)) {
    invalidatePreparedQuote();

    return getEntryState();
  }

  const routes =
    Array.isArray(prepared.routes)
      ? prepared.routes
      : [];

  const selectedRouteId =
    normalizeString(
      prepared.selected_route_id ||
        prepared.selected_route?.route_id
    );

  const selectedRoute =
    pickSelectedRoute({
      routes,
      selectedRouteId,
      selectedRoute:
        prepared.selected_route
    });

  state.context =
    prepared.form || null;

  state.session_id =
    normalizeString(prepared.session_id);

  state.registered =
    prepared.registered || null;

  state.resolved =
    prepared.resolved || null;

  state.quote =
    prepared.quote || null;

  state.routes =
    routes;

  state.selected_route_id =
    selectedRouteId;

  state.selected_route =
    selectedRoute;

  state.prepared_quote = {
    ...prepared,
    session_id:
      state.session_id,
    routes,
    selected_route_id:
      selectedRouteId,
    selected_route:
      selectedRoute
  };

  return getEntryState();
}

export function setSelectedRouteId(routeId) {
  const selectedRouteId =
    normalizeString(routeId);

  state.selected_route_id =
    selectedRouteId;

  state.selected_route =
    pickSelectedRoute({
      routes:
        state.routes,
      selectedRouteId
    });

  if (state.prepared_quote) {
    state.prepared_quote.selected_route_id =
      selectedRouteId;

    state.prepared_quote.selected_route =
      state.selected_route;
  }

  return getEntryState();
}

export function getPreparedQuote() {
  return clone(state.prepared_quote);
}

export function hasPreparedQuote() {
  return isValidPreparedQuote(
    state.prepared_quote
  );
}

export function invalidatePreparedQuote() {
  state.session_id = null;
  state.registered = null;
  state.resolved = null;
  state.quote = null;
  state.routes = [];
  state.selected_route_id = "";
  state.selected_route = null;
  state.prepared_quote = null;

  return getEntryState();
}

export function resetEntryState() {
  state = {
    ...initialState,
    routes: []
  };

  return getEntryState();
}
