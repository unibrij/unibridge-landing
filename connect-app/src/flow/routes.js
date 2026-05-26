// connect-app/src/flow/routes.js

import {
  ROUTES,
  getInitialBeneficiary
} from "../routes";

export function readPayoutIntentFromUrl() {
  const params =
    new URLSearchParams(window.location.search);

  return params.get("payout_intent_id");
}

export function resolveRouteIdFromIntent(intent = {}) {
  const rail =
    String(intent.rail || "").toUpperCase();

  const country =
    String(intent.country || "").toUpperCase();

  const route =
    ROUTES.find(item =>
      String(item.rail || "").toUpperCase() === rail &&
      String(item.country || "").toUpperCase() === country
    ) || ROUTES[0];

  return route.id;
}

export function buildFormFromIntent(
  intent = {},
  fallbackRoute = ROUTES[0]
) {
  return {
    amount: intent.amount ?? "",
    asset: intent.asset || fallbackRoute.assets[0],
    beneficiary:
      intent.beneficiary ||
      getInitialBeneficiary(fallbackRoute)
  };
}

export function buildEmptyForm(route = ROUTES[0]) {
  return {
    amount: "",
    asset: route.assets[0],
    beneficiary: getInitialBeneficiary(route)
  };
}
