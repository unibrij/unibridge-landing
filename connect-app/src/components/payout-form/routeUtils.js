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

function normalizeRoute(route) {
  if (
    !route ||
    typeof route !== "object" ||
    Array.isArray(route)
  ) {
    return {};
  }

  return route;
}

export function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function uniqueValues(values = []) {
  return Array.from(
    new Set(
      normalizeArray(values)
        .map(value => normalizeUpper(value))
        .filter(Boolean)
    )
  );
}

export function isComingSoonRoute(route = {}) {
  const safeRoute =
    normalizeRoute(route);

  return Boolean(
    safeRoute.comingSoon ||
      safeRoute.coming_soon ||
      safeRoute.disabled ||
      normalizeLower(
        safeRoute.status
      ) === "coming_soon"
  );
}

function getRouteId(route = {}) {
  const safeRoute =
    normalizeRoute(route);

  return normalizeLower(
    safeRoute.id ||
      safeRoute.route_id ||
      safeRoute.routeId
  );
}

function getRouteLabel(route = {}) {
  const safeRoute =
    normalizeRoute(route);

  return normalizeLower(
    safeRoute.label ||
      safeRoute.name
  );
}

function getRouteCountry(route = {}) {
  const safeRoute =
    normalizeRoute(route);

  return normalizeUpper(
    safeRoute.country ||
      safeRoute.destination_country ||
      safeRoute.destinationCountry ||
      safeRoute.country_code ||
      safeRoute.countryCode
  );
}

export function isBrazilRoute(route = {}) {
  const id =
    getRouteId(route);

  const label =
    getRouteLabel(route);

  const country =
    getRouteCountry(route);

  return (
    country === "BR" ||
    /(^|[_\-\s])br([_\-\s]|$)/.test(id) ||
    label.includes("brazil") ||
    label.includes("brasil") ||
    label.includes("pix")
  );
}

export function isPhilippinesRoute(route = {}) {
  const id =
    getRouteId(route);

  const label =
    getRouteLabel(route);

  const country =
    getRouteCountry(route);

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
  const safeRoute =
    normalizeRoute(route);

  const backendAssets =
    normalizeArray(
      safeRoute.assets
    );

  const baseAssets =
    backendAssets.length > 0
      ? backendAssets
      : safeRoute.asset
        ? [safeRoute.asset]
        : ["USDT"];

  if (isBrazilRoute(safeRoute)) {
    return uniqueValues([
      ...baseAssets,
      "USDT",
      "USDC"
    ]);
  }

  return uniqueValues(baseAssets);
}

export function getBeneficiaryFields(route = {}) {
  const safeRoute =
    normalizeRoute(route);

  if (
    isComingSoonRoute(
      safeRoute
    )
  ) {
    return [];
  }

  return normalizeArray(
    safeRoute.beneficiaryFields ||
      safeRoute.beneficiary_fields
  );
}

export function getRouteFlag(route = {}) {
  const safeRoute =
    normalizeRoute(route);

  const country =
    getRouteCountry(
      safeRoute
    );

  const id =
    getRouteId(
      safeRoute
    );

  const label =
    getRouteLabel(
      safeRoute
    );

  if (
    isBrazilRoute(
      safeRoute
    )
  ) {
    return "🇧🇷";
  }

  if (
    isPhilippinesRoute(
      safeRoute
    )
  ) {
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
  const safeRoute =
    normalizeRoute(route);

  const routeLabel =
    safeRoute.label ||
    safeRoute.name ||
    safeRoute.id ||
    safeRoute.route_id ||
    "Route";

  return `${
    getRouteFlag(
      safeRoute
    )
  } ${routeLabel}`;
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
  if (routeUnavailable) {
    return "Coming soon";
  }

  if (fundingTxHash) {
    return "Wallet submitted";
  }

  if (walletConfirmationPending) {
    return "Confirm in wallet";
  }

  if (settlement?.funding) {
    return "Ready to fund";
  }

  return "Route ready";
}

export function resolveButtonLabel({
  isBusy,
  settlement,
  walletConfirmationPending,
  routeUnavailable
} = {}) {
  if (routeUnavailable) {
    return "Coming soon";
  }

  if (walletConfirmationPending) {
    return "Open wallet again";
  }

  if (isBusy) {
    return "Preparing...";
  }

  if (settlement?.funding) {
    return "Send funding";
  }

  return "Continue";
}
