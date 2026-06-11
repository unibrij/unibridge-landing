// unibrij/unibridge-landing/surface/core/countryContext.js

/*
--------------------------------------------------
Surface Country Context

Purpose:
- keep source/receiver country helpers outside app.js
- preserve current fallback behavior
- avoid duplicating country checks across Surface modules

Current behavior:
- destination country comes from #country
- source country comes from #source_country
- if source_country is missing, fallback to #country
- if both are missing, fallback to BR
--------------------------------------------------
*/

function normalizeCountry(value) {
  return String(value || "")
    .toUpperCase()
    .trim();
}

function getElementValue(id) {
  const el =
    document.getElementById(id);

  return String(el?.value || "")
    .trim();
}

export function getDestinationCountryCode({
  countryId = "country"
} = {}) {
  return normalizeCountry(
    getElementValue(countryId)
  );
}

export function getSourceCountryCode({
  sourceCountryId = "source_country",
  fallbackCountryId = "country",
  defaultCountry = "BR"
} = {}) {
  const direct =
    normalizeCountry(
      getElementValue(sourceCountryId)
    );

  if (direct) {
    return direct;
  }

  const fallback =
    normalizeCountry(
      getElementValue(fallbackCountryId)
    );

  return fallback || defaultCountry;
}

export function isPhilippinesDestination(country) {
  return normalizeCountry(country) === "PH";
}

export function isBrazilDestination(country) {
  return normalizeCountry(country) === "BR";
}

export function getCountryLabel(country) {
  const receiver =
    normalizeCountry(country);

  if (receiver === "BR") {
    return "Brazil";
  }

  if (receiver === "PH") {
    return "Philippines";
  }

  if (receiver === "GB" || receiver === "UK") {
    return "United Kingdom";
  }

  return receiver || "Brazil";
}
