// unibridge-landing/surface/destination-payload.js

export function createDestinationPayloadBuilders({
  getValue,
  getCoinsPhPicker,
  isPhilippinesDestination,
  isBrazilDestination
} = {}) {
  function buildBrazilDestinationPayload() {
    const pix =
      getValue?.("pix")?.value.trim();

    const taxIdEl =
      getValue?.("taxId");

    const taxId =
      taxIdEl
        ? taxIdEl.value.trim()
        : "";

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

  function buildDestinationPayload() {
    if (isPhilippinesDestination?.()) {
      const coinsPhPicker =
        getCoinsPhPicker?.();

      if (!coinsPhPicker) {
        throw new Error("COINSPH_PICKER_NOT_READY");
      }

      return coinsPhPicker.buildDestination();
    }

    if (isBrazilDestination?.()) {
      return buildBrazilDestinationPayload();
    }

    throw new Error("unsupported_destination_country");
  }

  return {
    buildBrazilDestinationPayload,
    buildDestinationPayload
  };
}
