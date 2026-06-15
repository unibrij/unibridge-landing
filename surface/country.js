// unibridge-landing/surface/country.js

function normalizeUpper(value) {
  return String(value || "")
    .toUpperCase()
    .trim();
}

export function createCountryHelpers({
  getValue
} = {}) {
  function getDestinationCountryCode() {
    return normalizeUpper(
      getValue?.("country")?.value
    );
  }

  function isPhilippinesDestination() {
    return getDestinationCountryCode() === "PH";
  }

  function isBrazilDestination() {
    return getDestinationCountryCode() === "BR";
  }

  function getCountryLabel() {
    const receiver =
      getDestinationCountryCode();

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

  function getSourceCountryCode() {
    const direct =
      normalizeUpper(
        getValue?.("source_country")?.value
      );

    if (direct) {
      return direct;
    }

    const fallback =
      normalizeUpper(
        getValue?.("country")?.value
      );

    return fallback || "BR";
  }

  return {
    getDestinationCountryCode,
    isPhilippinesDestination,
    isBrazilDestination,
    getCountryLabel,
    getSourceCountryCode
  };
}
