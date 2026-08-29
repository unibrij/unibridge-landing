// unibridge-landing/surface/surface-destination.js

import {
  createCoinsPhPicker
} from "/shared/coinsph/coinsph-picker.js";

import {
  createSurfaceDestinationFields
} from "./destination-fields.js";

import {
  createDestinationPayloadBuilders
} from "./destination-payload.js";


export function createSurfaceDestination({
  container,
  continueBtn,
  coinsPhContinueBtn,
  apiGet,
  isPhilippinesDestination,
  receiveBound = false,
  getQuoteFlow
} = {}) {
  if (!container) {
    throw new Error(
      "surface_destination_mount_missing"
    );
  }


  let destinationFields =
    null;

  let coinsPhPicker =
    null;


  function getCurrentQuoteFlow() {
    return getQuoteFlow?.() || null;
  }


  function isCurrentRouteAmountAvailable() {
    return Boolean(
      getCurrentQuoteFlow()
        ?.isCurrentRouteAmountAvailable()
    );
  }


  /*
  --------------------------------------------------
  Generic destination state
  --------------------------------------------------
  */

  function syncGenericDestinationContinueState() {
    if (!continueBtn) {
      return;
    }

    if (receiveBound) {
      continueBtn.disabled =
        !isCurrentRouteAmountAvailable();

      return;
    }

    if (
      isPhilippinesDestination?.()
    ) {
      return;
    }

    let destinationValid =
      false;

    try {
      destinationFields
        ?.collect();

      destinationValid =
        true;
    }
    catch {
      destinationValid =
        false;
    }

    continueBtn.disabled =
      !destinationValid ||
      !isCurrentRouteAmountAvailable();
  }


  /*
  --------------------------------------------------
  Generic destination fields
  --------------------------------------------------
  */

  destinationFields =
    createSurfaceDestinationFields({
      container,

      onChange() {
        syncGenericDestinationContinueState();
      }
    });


  async function renderDestinationRoute(
    route
  ) {
    if (receiveBound) {
      destinationFields.clear();

      syncGenericDestinationContinueState();

      return false;
    }

    if (
      isPhilippinesDestination?.()
    ) {
      destinationFields.clear();

      return false;
    }

    const rendered =
      await destinationFields
        .renderRoute(
          route
        );

    syncGenericDestinationContinueState();

    return rendered;
  }


  function clearDestinationRoute() {
    destinationFields.clear();

    if (continueBtn) {
      continueBtn.disabled =
        true;
    }
  }


  /*
  --------------------------------------------------
  Coins.ph destination picker
  --------------------------------------------------
  */

  coinsPhPicker =
    createCoinsPhPicker({
      loadChannelOptions:
        async () => {
          const response =
            await apiGet(
              "options/coinsph/ph-payout-channels",
              {}
            );

          if (
            Array.isArray(
              response
            )
          ) {
            return response;
          }

          if (
            !response?.ok
          ) {
            throw new Error(
              response?.error ||
              "COINSPH_CHANNELS_LOAD_FAILED"
            );
          }

          if (
            Array.isArray(
              response.options
            )
          ) {
            return response.options;
          }

          if (
            Array.isArray(
              response.channels
            )
          ) {
            return response.channels;
          }

          if (
            Array.isArray(
              response.data
            )
          ) {
            return response.data;
          }

          return [];
        },

      isPhilippinesDestination,

      setContinueDisabled(
        value
      ) {
        if (
          !coinsPhContinueBtn
        ) {
          return;
        }

        coinsPhContinueBtn.disabled =
          Boolean(
            value
          ) ||
          !isCurrentRouteAmountAvailable();
      }
    });

  coinsPhPicker.bindEvents();


  /*
  --------------------------------------------------
  Destination payload
  --------------------------------------------------
  */

  const {
    buildDestinationPayload
  } =
    createDestinationPayloadBuilders({
      getCoinsPhPicker() {
        return coinsPhPicker;
      },

      isPhilippinesDestination,

      collectSharedDestination() {
        return destinationFields.collect();
      }
    });


  return {
    getCoinsPhPicker() {
      return coinsPhPicker;
    },

    buildDestinationPayload,
    renderDestinationRoute,
    clearDestinationRoute,
    syncGenericDestinationContinueState
  };
}
