// unibrij/unibridge-landing/surface/core/routePicker.js

/*
--------------------------------------------------
Surface Route Picker

Purpose:
- keep route selection outside app.js
- preserve existing Brazil / SmartPay behavior
- support backend-driven route metadata when available
- prevent Philippines Surface Card flow from silently
  selecting a non-GCash route

Design:
- Non-PH routes:
  keep current behavior: first backend route wins.
- PH routes:
  prefer backend-declared default/recommended route
  when it is compatible with GCash / wallet phone.
  otherwise fall back to route fields that clearly
  identify GCash.
--------------------------------------------------
*/

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .trim();
}

function normalizeCountry(value) {
  return String(value || "")
    .toUpperCase()
    .trim();
}

function normalizeNumber(value, fallback = 0) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function getDestinationSchema(route = {}) {
  return (
    route.destination_schema ||
    route.destinationSchema ||
    route.destination_form ||
    route.destinationForm ||
    route.ui_schema ||
    route.uiSchema ||
    null
  );
}

function getRouteCountry(route = {}) {
  return normalizeCountry(
    route.country ||
      route.receiver_country ||
      route.receiverCountry ||
      route.destination_country ||
      route.destinationCountry ||
      route.payout_country ||
      route.payoutCountry
  );
}

function routeTextPieces(route = {}) {
  const schema =
    getDestinationSchema(route) || {};

  return [
    route.id,
    route.route_id,
    route.routeId,

    route.name,
    route.label,

    route.executor,
    route.provider,
    route.partner_id,
    route.partnerId,
    route.sender_id,
    route.senderId,

    route.payout_rail,
    route.payoutRail,
    route.payout_channel,
    route.payoutChannel,

    route.bankCode,
    route.bankName,

    route.channelName,
    route.channelSubject,
    route.transactionChannel,
    route.transactionSubject,

    schema.type,
    schema.rail,
    schema.payout_rail,
    schema.payoutRail,
    schema.channelName,
    schema.channelSubject,

    schema?.fixed?.channelName,
    schema?.fixed?.channelSubject,
    schema?.fixed?.payout_rail,
    schema?.fixed?.payoutRail
  ]
    .map(normalizeText)
    .filter(Boolean);
}

function routeContains(route = {}, needle) {
  const normalizedNeedle =
    normalizeText(needle);

  if (!normalizedNeedle) {
    return false;
  }

  return routeTextPieces(route)
    .some((piece) =>
      piece.includes(normalizedNeedle)
    );
}

function routeLooksLikeGcash(route = {}) {
  return routeContains(route, "gcash");
}

function routeLooksLikeCoinsPh(route = {}) {
  return (
    routeContains(route, "coinsph") ||
    routeContains(route, "coins_ph") ||
    routeContains(route, "coins-ph")
  );
}

function routeLooksLikeWalletPhone(route = {}) {
  const schema =
    getDestinationSchema(route) || {};

  const type =
    normalizeText(
      schema.type ||
        schema.destination_type ||
        schema.destinationType
    );

  if (
    type === "wallet_phone" ||
    type === "wallet-phone" ||
    type === "mobile_wallet" ||
    type === "mobile-wallet" ||
    type === "phone_wallet" ||
    type === "phone-wallet"
  ) {
    return true;
  }

  const fields =
    Array.isArray(schema.fields)
      ? schema.fields
      : [];

  const fieldKeys =
    fields
      .map((field) =>
        normalizeText(
          field.key ||
            field.name ||
            field.id
        )
      )
      .filter(Boolean);

  const hasRecipientName =
    fieldKeys.some((key) =>
      key.includes("recipient") &&
      key.includes("name")
    ) ||
    fieldKeys.includes("name");

  const hasPhone =
    fieldKeys.some((key) =>
      key.includes("phone") ||
      key.includes("mobile") ||
      key.includes("wallet")
    );

  return hasRecipientName && hasPhone;
}

function routeIsBackendPreferred(route = {}) {
  return Boolean(
    route.is_default ||
      route.isDefault ||
      route.default ||
      route.recommended ||
      route.is_recommended ||
      route.isRecommended ||
      route.preferred ||
      route.is_preferred ||
      route.isPreferred
  );
}

function routeIsDisabled(route = {}) {
  const status =
    normalizeText(
      route.status ||
        route.state ||
        route.availability
    );

  if (
    status === "disabled" ||
    status === "inactive" ||
    status === "unavailable" ||
    status === "blocked"
  ) {
    return true;
  }

  if (route.enabled === false) {
    return true;
  }

  if (route.available === false) {
    return true;
  }

  return false;
}

function getRoutePriority(route = {}) {
  return normalizeNumber(
    route.priority ??
      route.rank ??
      route.order ??
      route.sort_order ??
      route.sortOrder,
    1000
  );
}

function scorePhilippinesRoute(route = {}) {
  if (!route || typeof route !== "object") {
    return -1;
  }

  if (routeIsDisabled(route)) {
    return -1;
  }

  let score = 0;

  if (routeLooksLikeGcash(route)) {
    score += 1000;
  }

  if (routeLooksLikeCoinsPh(route)) {
    score += 300;
  }

  if (routeLooksLikeWalletPhone(route)) {
    score += 200;
  }

  if (routeIsBackendPreferred(route)) {
    score += 100;
  }

  /*
  Lower backend priority should win.
  Convert it into a small score bonus.
  */
  const priority =
    getRoutePriority(route);

  score += Math.max(
    0,
    50 - Math.min(priority, 50)
  );

  return score;
}

function pickHighestScoredRoute(routes = [], scorer) {
  let bestRoute = null;
  let bestScore = -1;

  routes.forEach((route) => {
    const score =
      scorer(route);

    if (score > bestScore) {
      bestScore = score;
      bestRoute = route;
    }
  });

  return bestScore > 0
    ? bestRoute
    : null;
}

function pickPhilippinesRoute(routes = []) {
  /*
  --------------------------------------------------
  For now, Surface PH Card Payment must be GCash.
  Later, if backend adds another wallet_phone PH route
  and marks it recommended/default, this picker can
  support it without touching app.js.
  --------------------------------------------------
  */

  const selected =
    pickHighestScoredRoute(
      routes,
      scorePhilippinesRoute
    );

  if (!selected) {
    throw new Error("no_gcash_route");
  }

  if (!routeLooksLikeGcash(selected)) {
    throw new Error("no_gcash_route");
  }

  return selected;
}

function pickDefaultRoute(routes = []) {
  if (!Array.isArray(routes) || !routes.length) {
    return null;
  }

  const enabledRoutes =
    routes.filter((route) =>
      !routeIsDisabled(route)
    );

  const candidates =
    enabledRoutes.length
      ? enabledRoutes
      : routes;

  const preferred =
    candidates.find(routeIsBackendPreferred);

  if (preferred) {
    return preferred;
  }

  return candidates[0] || null;
}

export function pickSelectedRoute({
  routes = [],
  destinationCountry
} = {}) {
  if (!Array.isArray(routes) || !routes.length) {
    return null;
  }

  const receiver =
    normalizeCountry(destinationCountry);

  /*
  --------------------------------------------------
  Do not touch Brazil / SmartPay / PIX behavior.

  Existing behavior:
  first backend route wins.
  --------------------------------------------------
  */

  if (receiver !== "PH") {
    return routes[0];
  }

  return pickPhilippinesRoute(routes);
}

export function getRouteId(route = {}) {
  return (
    route.route_id ||
    route.routeId ||
    route.id ||
    null
  );
}

export {
  routeLooksLikeGcash,
  routeLooksLikeCoinsPh,
  routeLooksLikeWalletPhone,
  routeIsBackendPreferred,
  routeIsDisabled,
  getDestinationSchema,
  getRouteCountry
};
