// fiat/bank-transfer/js/destinationFields.js

import {
  clearFieldError,
  createHandledFieldError,
  markFieldInvalid
} from "./fieldErrors.js";

import {
  collectProviderDestination,
  renderProviderDestination,
  resetProviderDestinations
} from "./providerDestinationRegistry.js";

import {
  renderDestinationFields as renderSharedDestinationFields,
  collectDestination as collectSharedDestination,
  prefillDestination,
  clearDestinationFields as clearSharedDestinationFields
} from "/shared/pay/destination/fields.js";

import {
  createDestinationOptionsResolver
} from "/shared/pay/destination/options.js";

import {
  getRouteDestinationFields
} from "/shared/pay/destination/schema.js";

import {
  normalizeString
} from "/shared/pay/destination/fieldModel.js";


function getEl(
  id
) {
  return document.getElementById(
    id
  );
}


function getContainer() {
  return getEl(
    "destinationFields"
  );
}


function getDestinationField(
  name
) {
  const fieldName =
    normalizeString(
      name
    );

  if (!fieldName) {
    return null;
  }


  const container =
    getContainer();

  if (!container) {
    return null;
  }


  return (
    container.querySelector(
      `[data-destination-field-name="${CSS.escape(
        fieldName
      )}"]`
    ) ||
    getEl(
      `destination_${fieldName}`
    )
  );
}


/*
--------------------------------------------------
Values
--------------------------------------------------
*/

export function readDestinationFieldValues() {
  const container =
    getContainer();

  if (!container) {
    return {};
  }


  return collectSharedDestination({
    container
  });
}


export async function restoreDestinationFieldValues(
  values = {}
) {
  const container =
    getContainer();

  if (!container) {
    return;
  }


  await prefillDestination({
    container,

    beneficiary:
      values
  });
}


/*
--------------------------------------------------
Errors
--------------------------------------------------
*/

export function clearDestinationErrors() {
  getContainer()
    ?.querySelectorAll(
      "input, select, textarea"
    )
    .forEach(
      field => {
        clearFieldError(
          field
        );
      }
    );
}


export function markDestinationFieldInvalid(
  name,
  message
) {
  const input =
    getDestinationField(
      name
    );


  markFieldInvalid(
    input,
    message
  );
}


function bindClearErrorOnEdit(
  container
) {
  if (
    !container ||
    container.dataset
      .clearErrorOnEditBound ===
      "1"
  ) {
    return;
  }


  const clearEditedFieldError =
    event => {
      const field =
        event.target;


      if (
        !field?.matches?.(
          "input, select, textarea"
        )
      ) {
        return;
      }


      clearFieldError(
        field
      );
    };


  container.addEventListener(
    "input",
    clearEditedFieldError
  );


  container.addEventListener(
    "change",
    clearEditedFieldError
  );


  container.dataset
    .clearErrorOnEditBound =
    "1";
}


/*
--------------------------------------------------
Render
--------------------------------------------------
*/

export async function renderDestinationFields({
  availableRoutes = [],
  selectedRouteId = "",
  getSelectedRoute,
  onChange
} = {}) {
  const container =
    getContainer();


  if (!container) {
    return;
  }


  const previousValues =
    readDestinationFieldValues();


  if (
    !availableRoutes.length ||
    !selectedRouteId
  ) {
    clearSharedDestinationFields({
      container
    });

    resetProviderDestinations();

    return;
  }


  if (
    typeof getSelectedRoute !==
    "function"
  ) {
    throw new Error(
      "destination_selected_route_resolver_missing"
    );
  }


  const route =
    getSelectedRoute();


  /*
  ------------------------------------------------
  Temporary provider-specific adapter
  --------------------------------------------------
  */

  if (
    renderProviderDestination({
      container,
      route,
      onChange
    })
  ) {
    bindClearErrorOnEdit(
      container
    );

    return;
  }


  resetProviderDestinations();


  const fields =
    getRouteDestinationFields(
      route
    );


  const resolveOptions =
    createDestinationOptionsResolver({
      route
    });


  await renderSharedDestinationFields({
    container,
    route,
    fields,
    resolveOptions,
    initialValues:
      previousValues,
    onChange
  });


  bindClearErrorOnEdit(
    container
  );
}


/*
--------------------------------------------------
Validation
--------------------------------------------------
*/

function validateDestination({
  route,
  destination
}) {
  const container =
    getContainer();


  const renderedFields =
    container
      ? Array.from(
          container.querySelectorAll(
            "[data-destination-field='1']"
          )
        )
      : [];


  for (
    const field of
      renderedFields
  ) {
    const name =
      normalizeString(
        field.name ||
        field.dataset
          ?.destinationFieldName
      );


    if (!name) {
      continue;
    }


    const value =
      normalizeString(
        destination[
          name
        ]
      );


    if (
      field.required &&
      !value
    ) {
      const label =
        field
          .closest(
            ".destination-field"
          )
          ?.querySelector(
            ".destination-field-label"
          )
          ?.childNodes?.[0]
          ?.textContent
          ?.trim() ||
        name;


      const code =
        `destination_field_required_${name}`;


      const message =
        `${label} is required.`;


      markDestinationFieldInvalid(
        name,
        message
      );


      throw createHandledFieldError({
        code,

        field:
          `destination_${name}`,

        message
      });
    }
  }


  if (
    route.destination_required !==
      false &&
    renderedFields.length &&
    !Object.keys(
      destination
    ).length
  ) {
    throw createHandledFieldError({
      code:
        "destination_required",

      field:
        "destinationFields",

      message:
        "Destination details are required."
    });
  }
}


/*
--------------------------------------------------
Collect
--------------------------------------------------
*/

export function collectDestination(
  route = {}
) {
  clearDestinationErrors();


  const providerDestination =
    collectProviderDestination(
      route
    );


  if (
    providerDestination
  ) {
    return providerDestination;
  }


  const container =
    getContainer();


  const destination =
    collectSharedDestination({
      container
    });


  validateDestination({
    route,
    destination
  });


  return destination;
}
