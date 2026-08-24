// unibridge-landing/surface/destination-payload.js

export function createDestinationPayloadBuilders({
  getCoinsPhPicker,
  isPhilippinesDestination,
  collectSharedDestination
} = {}) {
  function buildDestinationPayload() {
    if (
      isPhilippinesDestination?.()
    ) {
      const picker =
        getCoinsPhPicker?.();

      if (!picker) {
        throw new Error(
          "COINSPH_PICKER_NOT_READY"
        );
      }

      return picker.buildDestination();
    }

    if (
      typeof collectSharedDestination !==
      "function"
    ) {
      throw new Error(
        "DESTINATION_COLLECTOR_MISSING"
      );
    }

    return collectSharedDestination();
  }

  return {
    buildDestinationPayload
  };
}
