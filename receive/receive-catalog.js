// unibridge-landing/receive/receive-catalog.js

function normalizeString(value) {
  return String(value ?? "").trim();
}

function normalizeUpper(value) {
  return normalizeString(value).toUpperCase();
}

function normalizeLower(value) {
  return normalizeString(value).toLowerCase();
}

export function formatRailLabel(value) {
  return normalizeString(value)
    .replace(/[_-]+/g, " ")
    .replace(
      /\b\w/g,
      character => character.toUpperCase()
    );
}

export function buildReceiveCatalog(payload = {}) {
  if (!Array.isArray(payload.routes)) {
    return [];
  }

  return payload.routes.filter(route => {
    return Boolean(
      normalizeString(route?.route_id) &&
      normalizeUpper(route?.country) &&
      normalizeString(route?.payout_rail)
    );
  });
}

function routesForCountry(catalog = [], country) {
  const targetCountry =
    normalizeUpper(country);

  return catalog.filter(route => {
    return (
      normalizeUpper(route?.country) ===
      targetCountry
    );
  });
}

export function railsForCountry(
  catalog = [],
  country
) {
  const rails = [];
  const seen = new Set();

  for (
    const route
    of routesForCountry(catalog, country)
  ) {
    const rail =
      normalizeLower(route?.payout_rail);

    if (
      !rail ||
      seen.has(rail)
    ) {
      continue;
    }

    seen.add(rail);
    rails.push(rail);
  }

  return rails;
}

export function findReceiveRoute(
  catalog = [],
  {
    country,
    rail
  } = {}
) {
  const targetCountry =
    normalizeUpper(country);

  const targetRail =
    normalizeLower(rail);

  return (
    catalog.find(route => {
      return (
        normalizeUpper(route?.country) ===
          targetCountry &&
        normalizeLower(route?.payout_rail) ===
          targetRail
      );
    }) ||
    null
  );
}
