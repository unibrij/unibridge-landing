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

  let renderGeneration =
    0;


  function requireContainer() {
    if (!container) {
      throw new Error(
        "SURFACE_DESTINATION_CONTAINER_MISSING"
      );
    }
  }


  function clear() {
    requireContainer();

    renderGeneration +=
      1;

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

    const generation =
      ++renderGeneration;

    currentRoute =
      route || null;

    clearDestinationFields({
      container
    });

    if (!currentRoute) {
      return false;
    }

    const routeToRender =
      currentRoute;

    const fields =
      getRouteDestinationFields(
        routeToRender
      );

    if (!fields.length) {
      return false;
    }

    const resolveOptions =
      createDestinationOptionsResolver({
        route:
          routeToRender
      });

    const stagingContainer =
      document.createElement(
        "div"
      );

    try {
      await renderDestinationFields({
        container:
          stagingContainer,

        route:
          routeToRender,

        fields,

        resolveOptions,

        onChange
      });
    }
    catch (
      error
    ) {
      if (
        generation !==
          renderGeneration ||
        currentRoute !==
          routeToRender
      ) {
        return false;
      }

      throw error;
    }

    if (
      generation !==
        renderGeneration ||
      currentRoute !==
        routeToRender
    ) {
      return false;
    }

    container.replaceChildren(
      ...stagingContainer.childNodes
    );

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

      const name =
        field.name ||
        field.dataset
          ?.destinationFieldName;

      const value =
        destination[
          name
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
