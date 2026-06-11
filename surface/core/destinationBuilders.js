// unibrij/unibridge-landing/surface/core/destinationBuilders.js

/*
--------------------------------------------------
Surface Destination Builders

Purpose:
- keep destination payload construction outside app.js
- preserve existing Brazil / PIX behavior
- delegate Philippines destination to CoinsPH picker
- leave room for backend-driven destination schemas later

Current supported destinations:
- BR: PIX key + optional tax_id
- PH: CoinsPH picker destination payload

Future:
- schema-driven destination renderer/builder can be added
  here without growing app.js again.
--------------------------------------------------
*/

function normalizeCountry(value) {
  return String(value || "")
    .toUpperCase()
    .trim();
}

function normalizeText(value) {
  return String(value || "")
    .trim();
}

function getElementValue(id) {
  const el =
    document.getElementById(id);

  return normalizeText(
    el?.value
  );
}

export function isBrazilDestination(country) {
  return normalizeCountry(country) === "BR";
}

export function isPhilippinesDestination(country) {
  return normalizeCountry(country) === "PH";
}

export function buildBrazilDestinationPayload({
  pixId = "pix",
  taxIdId = "taxId"
} = {}) {
  const pix =
    getElementValue(pixId);

  const taxId =
    getElementValue(taxIdId);

  if (!pix) {
    throw new Error("PIX_required");
  }

  return taxId
    ? {
        pix,
        tax_id:
          taxId
      }
    : {
        pix
      };
}

export function buildPhilippinesDestinationPayload({
  coinsPhPicker
} = {}) {
  if (!coinsPhPicker) {
    throw new Error("COINSPH_PICKER_NOT_READY");
  }

  if (
    typeof coinsPhPicker.buildDestination !== "function"
  ) {
    throw new Error("COINSPH_PICKER_BUILD_DESTINATION_MISSING");
  }

  return coinsPhPicker.buildDestination();
}

export function buildDestinationPayload({
  destinationCountry,
  coinsPhPicker
} = {}) {
  const country =
    normalizeCountry(destinationCountry);

  if (isPhilippinesDestination(country)) {
    return buildPhilippinesDestinationPayload({
      coinsPhPicker
    });
  }

  if (isBrazilDestination(country)) {
    return buildBrazilDestinationPayload();
  }

  throw new Error("unsupported_destination_country");
}
