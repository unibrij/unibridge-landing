// pay-by-bank/js/flow/destination.js

import {
  collectDestination,
  renderDestinationFields
} from "/fiat/bank-transfer/js/destinationFields.js";

import {
  hasProviderDestination
} from "/fiat/bank-transfer/js/providerDestinationRegistry.js";

import {
  clearDestinationFields,
  showDestinationFields
} from "../ui.js";


function assertDestinationContract(
  route
) {
  if (!route) {
    throw new Error(
      "selected_route_missing"
    );
  }

  const fields =
    Array.isArray(
      route
        .required_destination_fields
    )
      ? route
          .required_destination_fields
      : [];

  const hasProviderFields =
    hasProviderDestination(
      route
    );

  if (
    route.destination_required !==
      false &&
    fields.length === 0 &&
    !hasProviderFields
  ) {
    throw new Error(
      "route_destination_fields_missing"
    );
  }
}


export function renderSelectedDestination({
  routes,
  selectedRoute,
  onChange
}) {
  assertDestinationContract(
    selectedRoute
  );

  clearDestinationFields();

  renderDestinationFields({
    availableRoutes:
      routes,

    selectedRouteId:
      selectedRoute.route_id,

    getSelectedRoute() {
      return selectedRoute;
    },

    onChange:
      typeof onChange ===
        "function"
        ? onChange
        : undefined
  });

  showDestinationFields();
}


export function collectSelectedDestination(
  selectedRoute
) {
  assertDestinationContract(
    selectedRoute
  );

  return collectDestination(
    selectedRoute
  );
}
