// shared/pay/destination/fieldModel.js

import {
  getRouteDestinationFields
} from "./schema.js";


export function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}


export function isObject(
  value
) {
  return Boolean(
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
  );
}


/*
--------------------------------------------------
Options
--------------------------------------------------
*/

export function normalizeOption(
  option
) {
  if (
    option === null ||
    option === undefined
  ) {
    return null;
  }


  if (
    typeof option ===
      "string" ||
    typeof option ===
      "number"
  ) {
    const value =
      normalizeString(
        option
      );

    if (!value) {
      return null;
    }

    return {
      value,

      label:
        value,

      raw:
        option
    };
  }


  if (!isObject(option)) {
    return null;
  }


  const value =
    normalizeString(
      option.value ??
      option.id ??
      option.code ??
      option.key ??
      option.name
    );

  if (!value) {
    return null;
  }


  return {
    value,

    label:
      normalizeString(
        option.label ??
        option.title ??
        option.display_name ??
        option.displayName ??
        option.name ??
        value
      ) ||
      value,

    raw:
      isObject(
        option.raw
      )
        ? option.raw
        : option
  };
}


export function normalizeOptions(
  options
) {
  if (
    !Array.isArray(
      options
    )
  ) {
    return [];
  }

  return options
    .map(
      normalizeOption
    )
    .filter(
      Boolean
    );
}


export function staticOptionsOf(
  field = {}
) {
  return normalizeOptions(
    field.options ||
    field.values ||
    field.enum ||
    field.choices
  );
}


/*
--------------------------------------------------
Dependent fields
--------------------------------------------------
*/

export function dependentFieldsOf(
  option
) {
  const raw =
    option?.raw;

  if (!isObject(raw)) {
    return [];
  }

  return getRouteDestinationFields({
    required_destination_fields:
      raw.required_destination_fields,

    destination_fields:
      raw.destination_fields,

    beneficiary_fields:
      raw.beneficiary_fields,

    recipient_fields:
      raw.recipient_fields,

    destination_schema:
      raw.destination_schema,

    beneficiary_schema:
      raw.beneficiary_schema,

    recipient_schema:
      raw.recipient_schema,

    instruction_schema:
      raw.instruction_schema,

    schema:
      raw.schema,

    fields:
      raw.fields
  });
}
