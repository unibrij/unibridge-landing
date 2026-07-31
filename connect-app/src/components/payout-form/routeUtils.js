// connect-app/src/components/payout-form/routeUtils.js

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeUpper(value) {
  return normalizeString(value).toUpperCase();
}

function normalizeLower(value) {
  return normalizeString(value).toLowerCase();
}

export function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function uniqueValues(values = []) {
  return Array.from(
    new Set(
      values
        .map(value => normalizeUpper(value))
        .filter(Boolean)
    )
  );
}

export function isComingSoonRoute(route = {}) {
  return Boolean(
    route.comingSoon ||
      route.coming_soon ||
      route.disabled ||
      normalizeLower(route.status) === "coming_soon"
  );
}

function getRouteId(route = {}) {
  return normalizeLower(
    route.id ||
      route.route_id ||
      route.routeId
  );
}

function getRouteLabel(route = {}) {
  return normalizeLower(
    route.label ||
      route.name
  );
}

function getRouteCountry(route = {}) {
  return normalizeUpper(
    route.country ||
      route.destination_country ||
      route.destinationCountry ||
      route.country_code ||
      route.countryCode
  );
}

export function isBrazilRoute(route = {}) {
  const id = getRouteId(route);
  const label = getRouteLabel(route);
  const country = getRouteCountry(route);

  return (
    country === "BR" ||
    /(^|[_\-\s])br([_\-\s]|$)/.test(id) ||
    label.includes("brazil") ||
    label.includes("brasil") ||
    label.includes("pix")
  );
}

export function isPhilippinesRoute(route = {}) {
  const id = getRouteId(route);
  const label = getRouteLabel(route);
  const country = getRouteCountry(route);

  return (
    country === "PH" ||
    /(^|[_\-\s])ph([_\-\s]|$)/.test(id) ||
    label.includes("philippines") ||
    label.includes("gcash") ||
    label.includes("instapay") ||
    label.includes("pesonet")
  );
}

export function getRouteAssets(route = {}) {
  const backendAssets = normalizeArray(route.assets);

  const baseAssets =
    backendAssets.length > 0
      ? backendAssets
      : route.asset
        ? [route.asset]
        : ["USDT"];

  if (isBrazilRoute(route)) {
    return uniqueValues([
      ...baseAssets,
      "USDT",
      "USDC"
    ]);
  }

  return uniqueValues(baseAssets);
}

export function getBeneficiaryFields(route = {}) {
  if (isComingSoonRoute(route)) {
    return [];
  }

  return normalizeArray(
    route.beneficiaryFields ||
      route.beneficiary_fields
  );
}

export function getRouteFlag(route = {}) {
  const country = getRouteCountry(route);
  const id = getRouteId(route);
  const label = getRouteLabel(route);

  if (isBrazilRoute(route)) {
    return "🇧🇷";
  }

  if (isPhilippinesRoute(route)) {
    return "🇵🇭";
  }

  if (
    country === "KE" ||
    /(^|[_\-\s])ke([_\-\s]|$)/.test(id) ||
    label.includes("kenya") ||
    label.startsWith("ke ")
  ) {
    return "🇰🇪";
  }

  if (
    country === "UG" ||
    /(^|[_\-\s])ug([_\-\s]|$)/.test(id) ||
    label.includes("uganda") ||
    label.startsWith("ug ")
  ) {
    return "🇺🇬";
  }

  if (
    country === "NG" ||
    /(^|[_\-\s])ng([_\-\s]|$)/.test(id) ||
    label.includes("nigeria") ||
    label.startsWith("ng ")
  ) {
    return "🇳🇬";
  }

  if (
    country === "MX" ||
    /(^|[_\-\s])mx([_\-\s]|$)/.test(id) ||
    label.includes("mexico") ||
    label.includes("méxico") ||
    label.includes("spei")
  ) {
    return "🇲🇽";
  }

  if (
    country === "IN" ||
    /(^|[_\-\s])in([_\-\s]|$)/.test(id) ||
    label.includes("india") ||
    label.includes("upi")
  ) {
    return "🇮🇳";
  }

  return "🌐";
}

export function getRouteDisplayLabel(route = {}) {
  const routeLabel =
    route.label ||
    route.name ||
    route.id ||
    route.route_id ||
    "Route";

  return `${getRouteFlag(route)} ${routeLabel}`;
}

export function getNetworkDisplayName(network = "") {
  const value = normalizeLower(network);

  if (value === "polygon") {
    return "Polygon";
  }

  return network || "Network";
}

export function resolveDisplayStatus({
  settlement,
  fundingTxHash,
  walletConfirmationPending,
  routeUnavailable
} = {}) {
  if (routeUnavailable) return "Coming soon";
  if (fundingTxHash) return "Wallet submitted";
  if (walletConfirmationPending) return "Confirm in wallet";
  if (settlement?.funding) return "Ready to fund";

  return "Route ready";
}

export function resolveButtonLabel({
  isBusy,
  settlement,
  walletConfirmationPending,
  routeUnavailable
} = {}) {
  if (routeUnavailable) return "Coming soon";
  if (walletConfirmationPending) return "Open wallet again";
  if (isBusy) return "Preparing...";
  if (settlement?.funding) return "Send funding";

  return "Continue";
}
