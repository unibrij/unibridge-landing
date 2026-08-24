// unibridge-landing/surface/destination-fields.js

import {
  renderDestinationFields,
  collectDestination,
  clearDestinationFields
} from "/shared/pay/destination/fields.js";

import {
  createDestinationOptionsResolver
} from "/shared/pay/destination/options.js";

import {
  getRouteDestinationFields
} from "/shared/pay/destination/schema.js";


export function createSurfaceDestinationFields({
  container,
  onChange
} = {}) {
  let currentRoute =
    null;


  function requireContainer() {
    if (!container) {
      throw new Error(
        "SURFACE_DESTINATION_CONTAINER_MISSING"
      );
    }
  }


  function clear() {
    requireContainer();

    currentRoute =
      null;

    clearDestinationFields({
      container
    });
  }


  async function renderRoute(
    route = null
  ) {
    requireContainer();

    currentRoute =
      route || null;

    clearDestinationFields({
      container
    });

    if (!currentRoute) {
      return false;
    }

    const fields =
      getRouteDestinationFields(
        currentRoute
      );

    if (!fields.length) {
      return false;
    }

    const resolveOptions =
      createDestinationOptionsResolver({
        route:
          currentRoute
      });

    await renderDestinationFields({
      container,

      route:
        currentRoute,

      fields,

      resolveOptions,

      onChange
    });

    return true;
  }


  function collect() {
    requireContainer();

    const destination =
      collectDestination({
        container
      });

    const renderedFields =
      Array.from(
        container.querySelectorAll(
          "[data-destination-field='1']"
        )
      );

    for (
      const field of
        renderedFields
    ) {
      if (!field.required) {
        continue;
      }

      const value =
        destination[
          field.name ||
          field.dataset
            ?.destinationFieldName
        ];

      if (
        value ===
          undefined ||
        value ===
          null ||
        String(
          value
        ).trim() ===
          ""
      ) {
        throw new Error(
          "DESTINATION_FIELD_REQUIRED"
        );
      }
    }

    return destination;
  }


  function getCurrentRoute() {
    return currentRoute;
  }


  return {
    renderRoute,
    collect,
    clear,
    getCurrentRoute
  };
}
