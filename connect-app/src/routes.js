// connect-app/src/routes.js

export const FALLBACK_ROUTES = [
  {
    id: "br_pix",
    route_id: "br_pix",
    label: "Brazil PIX route",
    country: "BR",
    rail: "PIX",
    payout_rail: "pix",
    network: "polygon",
    assets: ["USDT", "USDC"],

    beneficiaryFields: [
      {
        name: "pix_key",
        label: "PIX key",
        type: "text",
        placeholder: "email, CPF, phone, or random key",
        required: true
      }
    ]
  }
];

export const ROUTES = FALLBACK_ROUTES;

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeUpper(value) {
  return normalizeString(value).toUpperCase();
}

function normalizeLower(value) {
  return normalizeString(value).toLowerCase();
}

function fallbackPlaceholder(field = {}) {
  const name =
    normalizeLower(field.name);

  if (name.includes("pix")) {
    return "email, CPF, phone, or random key";
  }

  if (name.includes("recipient_identifier")) {
    return "phone, account, or wallet identifier";
  }

  if (name.includes("channel")) {
    return "bank or payout channel";
  }

  return "";
}

export function normalizeBackendRoute(route = {}) {
  const asset =
    normalizeUpper(route.asset);

  const id =
    route.route_id ||
    route.id ||
    [
      route.country,
      route.rail,
      route.network,
      asset
    ]
      .map(part => normalizeLower(part))
      .filter(Boolean)
      .join("_");

  const beneficiaryFields =
    Array.isArray(route.beneficiary_fields)
      ? route.beneficiary_fields.map(field => ({
          name: field.name,
          label: field.label || field.name,
          type: field.type || "text",
          placeholder:
            field.placeholder ||
            fallbackPlaceholder(field),
          required: Boolean(field.required)
        }))
      : [];

  return {
    ...route,

    id,
    route_id: route.route_id || id,

    label:
      route.label ||
      id,

    country:
      normalizeUpper(route.country),

    rail:
      normalizeUpper(route.rail),

    payout_rail:
      normalizeLower(
        route.payout_rail ||
        route.rail
      ),

    network:
      normalizeLower(route.network),

    asset,

    assets:
      asset ? [asset] : [],

    beneficiaryFields
  };
}

export function normalizeBackendRoutes(routes = []) {
  const normalized =
    Array.isArray(routes)
      ? routes.map(normalizeBackendRoute)
      : [];

  return normalized.length > 0
    ? normalized
    : FALLBACK_ROUTES;
}

export function getRouteById(routeId, routes = ROUTES) {
  return (
    routes.find(route =>
      route.id === routeId ||
      route.route_id === routeId
    ) ||
    routes[0] ||
    FALLBACK_ROUTES[0]
  );
}

export function getInitialBeneficiary(route) {
  const fields =
    route?.beneficiaryFields || [];

  return fields.reduce((acc, field) => {
    acc[field.name] = "";
    return acc;
  }, {});
}
