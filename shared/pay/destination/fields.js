// shared/pay/destination/fields.js

import {
  getRouteDestinationFields
} from "./schema.js";

import {
  renderFields
} from "./fieldRenderer.js";

import {
  collectDestination,
  prefillDestination,
  clearDestinationFields
} from "./fieldValues.js";

import {
  isObject
} from "./fieldModel.js";


/*
--------------------------------------------------
Render
--------------------------------------------------
*/

export async function renderDestinationFields({
  container,
  route,
  fields,
  resolveOptions,
  initialValues = {},
  onChange
} = {}) {
  if (!container) {
    throw new Error(
      "destination_fields_container_missing"
    );
  }


  const resolvedFields =
    Array.isArray(
      fields
    )
      ? fields
      : getRouteDestinationFields(
          route || {}
        );


  const values = {
    ...(
      isObject(
        initialValues
      )
        ? initialValues
        : {}
    )
  };


  container.replaceChildren();


  await renderFields({
    container,

    fields:
      resolvedFields,

    resolveOptions,
    values,
    onChange
  });


  if (
    Object.keys(
      values
    ).length
  ) {
    await prefillDestination({
      container,

      beneficiary:
        values
    });
  }


  return {
    fields:
      resolvedFields,

    values
  };
}


/*
--------------------------------------------------
Public API
--------------------------------------------------
*/

export {
  collectDestination,
  prefillDestination,
  clearDestinationFields
};
