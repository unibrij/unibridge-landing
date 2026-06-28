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
    asset: "USDT",
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

function uniqueValues(values = []) {
  return Array.from(
    new Set(
      values
        .map(value => normalizeUpper(value))
        .filter(Boolean)
    )
  );
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

  if (name.includes("recipient_institution")) {
    return "Select bank or wallet";
  }

  if (name.includes("institution")) {
    return "Select bank or wallet";
  }

  if (name.includes("channel")) {
    return "bank or payout channel";
  }

  return "";
}

function isBrazilPixRoute({
  id,
  label,
  country,
  rail,
  payoutRail
}) {
  const routeId =
    normalizeLower(id);

  const routeLabel =
    normalizeLower(label);

  const normalizedCountry =
    normalizeUpper(country);

  const normalizedRail =
    normalizeLower(rail);

  const normalizedPayoutRail =
    normalizeLower(payoutRail);

  return (
    normalizedCountry === "BR" ||
    routeId.includes("br_pix") ||
    routeId.includes("brazil") ||
    routeLabel.includes("brazil") ||
    routeLabel.includes("pix") ||
    normalizedRail === "pix" ||
    normalizedPayoutRail === "pix"
  );
}

function isConnectVisibleRoute(route = {}) {
  const country =
    normalizeUpper(route.country);

  const payoutRail =
    normalizeLower(
      route.payout_rail ||
        route.payoutRail ||
        route.rail
    );

  /*
  --------------------------------------------------
  Connect PH route visibility

  Keep Philippines as one visible destination in Connect
  for now. InstaPay is the primary wallet route.

  PESONet remains available in backend capabilities and
  Surface dynamic picker, but is hidden from Connect UI
  until Connect gets a dedicated rail selector.
  --------------------------------------------------
  */

  if (
    country === "PH" &&
    payoutRail === "pesonet"
  ) {
    return false;
  }

  return true;
}

function normalizeBeneficiaryFields(route = {}) {
  const backendFields =
    Array.isArray(route.beneficiary_fields)
      ? route.beneficiary_fields
      : Array.isArray(route.beneficiaryFields)
        ? route.beneficiaryFields
        : [];

  return backendFields.map(field => ({
    ...field,

    name:
      field.name,

    label:
      field.label || field.name,

    type:
      field.type || "text",

    placeholder:
      field.placeholder ||
      fallbackPlaceholder(field),

    required:
      Boolean(field.required),

    source:
      field.source || null,

    value_field:
      field.value_field || null,

    label_field:
      field.label_field || null,

    channel_field:
      field.channel_field || null
  }));
}

export function normalizeBackendRoute(route = {}) {
  const asset =
    normalizeUpper(route.asset);

  const backendAssets =
    Array.isArray(route.assets)
      ? route.assets
      : Array.isArray(route.supported_assets)
        ? route.supported_assets
        : Array.isArray(route.supportedAssets)
          ? route.supportedAssets
          : [];

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

  const label =
    route.label ||
    id;

  const country =
    normalizeUpper(route.country);

  const rail =
    normalizeUpper(route.rail);

  const payoutRail =
    normalizeLower(
      route.payout_rail ||
      route.payoutRail ||
      route.rail
    );

  const network =
    normalizeLower(route.network);

  const isBrazilPix =
    isBrazilPixRoute({
      id,
      label,
      country,
      rail,
      payoutRail
    });

  const assets =
    isBrazilPix
      ? uniqueValues([
          ...backendAssets,
          asset,
          "USDT",
          "USDC"
        ])
      : uniqueValues([
          ...backendAssets,
          asset
        ]);

  const normalizedAsset =
    asset || assets[0] || "";

  const beneficiaryFields =
    normalizeBeneficiaryFields(route);

  return {
    ...route,

    id,
    route_id:
      route.route_id || id,

    label,

    country,

    rail,

    payout_rail:
      payoutRail,

    network,

    asset:
      normalizedAsset,

    assets,

    beneficiaryFields
  };
}

export function normalizeBackendRoutes(routes = []) {
  const normalized =
    Array.isArray(routes)
      ? routes.map(normalizeBackendRoute)
      : [];

  const visible =
    normalized.filter(isConnectVisibleRoute);

  return visible.length > 0
    ? visible
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
