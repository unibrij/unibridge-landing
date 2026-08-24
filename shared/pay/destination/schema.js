// shared/pay/destination/schema.js

function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}


function normalizeField(
  field = {},
  fallbackName = ""
) {
  const source =
    (
      field &&
      typeof field === "object" &&
      !Array.isArray(
        field
      )
    )
      ? field
      : {};

  const name =
    normalizeString(
      source.name ||
      source.key ||
      source.id ||
      fallbackName
    );

  if (!name) {
    return null;
  }

  const normalized = {
    ...source,

    name,

    label:
      normalizeString(
        source.label ||
        source.title
      ) ||
      name,

    type:
      normalizeString(
        source.type
      ) ||
      "text",

    required:
      source.required !==
      false
  };

  return normalized;
}


function normalizeFields(
  candidate
) {
  if (!candidate) {
    return [];
  }


  /*
  ------------------------------------------------
  Plain field array
  ------------------------------------------------
  */

  if (
    Array.isArray(
      candidate
    )
  ) {
    return candidate
      .map(
        field =>
          normalizeField(
            field
          )
      )
      .filter(
        Boolean
      );
  }


  if (
    typeof candidate !==
    "object"
  ) {
    return [];
  }


  /*
  ------------------------------------------------
  { fields: [...] }
  ------------------------------------------------
  */

  if (
    Array.isArray(
      candidate.fields
    )
  ) {
    return candidate.fields
      .map(
        field =>
          normalizeField(
            field
          )
      )
      .filter(
        Boolean
      );
  }


  /*
  ------------------------------------------------
  JSON-schema-like shape

  {
    properties: {
      account: {...}
    },
    required: [...]
  }
  ------------------------------------------------
  */

  if (
    candidate.properties &&
    typeof candidate.properties ===
      "object" &&
    !Array.isArray(
      candidate.properties
    )
  ) {
    const requiredNames =
      new Set(
        Array.isArray(
          candidate.required
        )
          ? candidate.required
              .map(
                normalizeString
              )
              .filter(
                Boolean
              )
          : []
      );

    return Object
      .entries(
        candidate.properties
      )
      .map(
        ([
          name,
          field
        ]) => {
          return normalizeField(
            {
              ...(
                field &&
                typeof field ===
                  "object"
                  ? field
                  : {}
              ),

              required:
                requiredNames.has(
                  name
                ) ||
                field?.required ===
                  true
            },

            name
          );
        }
      )
      .filter(
        Boolean
      );
  }


  /*
  ------------------------------------------------
  Object keyed by field name

  {
    account: {...},
    name: {...}
  }
  ------------------------------------------------
  */

  return Object
    .entries(
      candidate
    )
    .filter(
      ([
        ,
        value
      ]) => {
        return (
          value &&
          typeof value ===
            "object" &&
          !Array.isArray(
            value
          )
        );
      }
    )
    .map(
      ([
        name,
        field
      ]) =>
        normalizeField(
          field,
          name
        )
    )
    .filter(
      Boolean
    );
}


/*
--------------------------------------------------
Route destination fields

Prefer the Fiat canonical contract first.

Compatibility fallbacks are retained for route payloads
already emitted by existing backend / Connect projections.
--------------------------------------------------
*/

export function getRouteDestinationFields(
  route = {}
) {
  const candidates = [
    route.required_destination_fields,

    route.destination_fields,

    route.beneficiary_fields,

    route.beneficiaryFields,

    route.connect_beneficiary_fields,

    route.recipient_fields,

    route.destination_schema,

    route.beneficiary_schema,

    route.recipient_schema,

    route.instruction_schema,

    route.fields,

    route.schema,

    route.destination
      ?.fields,

    route.destination
      ?.schema
  ];

  for (
    const candidate of
      candidates
  ) {
    const fields =
      normalizeFields(
        candidate
      );

    if (
      fields.length
    ) {
      return fields;
    }
  }

  return [];
}


/*
--------------------------------------------------
Destination requirement
--------------------------------------------------
*/

export function routeRequiresDestination(
  route = {}
) {
  if (
    route.destination_required ===
    false
  ) {
    return false;
  }

  return (
    getRouteDestinationFields(
      route
    ).length >
    0
  );
}
