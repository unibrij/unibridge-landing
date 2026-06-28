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
      route.status === "coming_soon"
  );
}

export function isBrazilRoute(route = {}) {
  const id =
    normalizeLower(
      route.id || route.route_id
    );

  const label =
    normalizeLower(
      route.label || route.name
    );

  const country =
    normalizeUpper(
      route.destination_country ||
        route.destinationCountry ||
        route.country
    );

  return (
    country === "BR" ||
    id.includes("br") ||
    label.includes("brazil") ||
    label.includes("pix")
  );
}

export function isPhilippinesRoute(route = {}) {
  const id =
    normalizeLower(
      route.id || route.route_id
    );

  const label =
    normalizeLower(
      route.label || route.name
    );

  const country =
    normalizeUpper(
      route.destination_country ||
        route.destinationCountry ||
        route.country
    );

  return (
    country === "PH" ||
    id.includes("ph") ||
    label.includes("philippines") ||
    label.includes("gcash") ||
    label.includes("instapay") ||
    label.includes("pesonet")
  );
}

export function getRouteAssets(route = {}) {
  const backendAssets =
    normalizeArray(route.assets);

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

  return normalizeArray(route.beneficiaryFields);
}

export function getRouteFlag(route = {}) {
  const country =
    normalizeUpper(route.country);

  if (isBrazilRoute(route)) return "🇧🇷";
  if (isPhilippinesRoute(route)) return "🇵🇭";
  if (country === "MX") return "🇲🇽";
  if (country === "IN") return "🇮🇳";
  if (country === "NG") return "🇳🇬";

  return "🌐";
}

export function getRouteDisplayLabel(route = {}) {
  return `${getRouteFlag(route)} ${route.label || route.name || route.id || "Route"}`;
}

export function getNetworkDisplayName(network = "") {
  const value =
    normalizeLower(network);

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
