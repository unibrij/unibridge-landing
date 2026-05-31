// connect-app/src/flow/routes.js

import {
  ROUTES,
  getInitialBeneficiary,
  getRouteById
} from "../routes";

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeUpper(value) {
  return normalizeString(value).toUpperCase();
}

function getRouteAssets(route = {}) {
  return Array.isArray(route.assets) && route.assets.length > 0
    ? route.assets
    : route.asset
      ? [route.asset]
      : ["USDT"];
}

function routeSupportsAsset(route = {}, asset = "") {
  const targetAsset =
    normalizeUpper(asset);

  if (!targetAsset) {
    return true;
  }

  return (
    normalizeUpper(route.asset) === targetAsset ||
    getRouteAssets(route)
      .map(normalizeUpper)
      .includes(targetAsset)
  );
}

export function readPayoutIntentFromUrl() {
  const params =
    new URLSearchParams(window.location.search);

  return params.get("payout_intent_id");
}

export function resolveRouteIdFromIntent(
  intent = {},
  routes = ROUTES
) {
  if (intent.route_id) {
    const route =
      getRouteById(intent.route_id, routes);

    return route.id;
  }

  const rail =
    normalizeUpper(intent.rail);

  const country =
    normalizeUpper(intent.country);

  const asset =
    normalizeUpper(intent.asset);

  const route =
    routes.find(item =>
      normalizeUpper(item.rail) === rail &&
      normalizeUpper(item.country) === country &&
      routeSupportsAsset(item, asset)
    ) ||
    routes[0] ||
    ROUTES[0];

  return route.id;
}

export function buildFormFromIntent(
  intent = {},
  fallbackRoute = ROUTES[0]
) {
  const assets =
    getRouteAssets(fallbackRoute);

  return {
    amount: intent.amount ?? "",
    asset: intent.asset || assets[0],
    beneficiary:
      intent.beneficiary ||
      getInitialBeneficiary(fallbackRoute)
  };
}

export function buildEmptyForm(route = ROUTES[0]) {
  const assets =
    getRouteAssets(route);

  return {
    amount: "",
    asset: assets[0],
    beneficiary: getInitialBeneficiary(route)
  };
}
