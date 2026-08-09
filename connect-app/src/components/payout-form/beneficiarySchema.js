// connect-app/src/components/payout-form/beneficiarySchema.js

import {
  normalizeArray
} from "./routeUtils.js";

import {
  resolveFieldSchemaKey
} from "./dynamicOptions.js";

function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}

function normalizeLower(
  value
) {
  return normalizeString(
    value
  ).toLowerCase();
}

export function normalizeDynamicFieldName(
  value
) {
  const name =
    normalizeString(
      value
    );

  switch (name) {
    case "recipientName":
    case "recipient_name":
      return "name";

    case "recipientAccountNumber":
    case "recipient_account_number":
      return "account";

    case "recipientAddress":
    case "recipient_address":
      return "recipient_address";

    case "recipientPhone":
    case "recipient_phone":
      return "phone";

    case "recipientPixKey":
    case "recipient_pix_key":
      return "pix_key";

    default:
      return name;
  }
}

export function buildFieldLabel(
  name
) {
  const normalizedName =
    normalizeDynamicFieldName(
      name
    );

  switch (normalizedName) {
    case "name":
      return "Recipient name";

    case "account":
      return "Recipient account or wallet number";

    case "recipient_address":
      return "Recipient address";

    case "phone":
      return "Recipient phone";

    case "pix_key":
      return "PIX key";

    case "remarks":
      return "Remarks";

    default:
      return normalizedName
        .replace(
          /_/g,
          " "
        )
        .replace(
          /\b\w/g,
          character =>
            character.toUpperCase()
        );
  }
}

function normalizeFieldNameList(
  value
) {
  return normalizeArray(
    value
  )
    .map(item => {
      if (
        item &&
        typeof item ===
          "object"
      ) {
        return normalizeString(
          item.name ||
            item.field ||
            item.key
        );
      }

      return normalizeString(
        item
      );
    })
    .filter(Boolean);
}

function normalizeDynamicSchemaField({
  rawField,
  requiredNames,
  optionalNames
}) {
  const fieldObject =
    rawField &&
    typeof rawField ===
      "object" &&
    !Array.isArray(
      rawField
    )
      ? rawField
      : {};

  const rawName =
    normalizeString(
      fieldObject.name ||
        fieldObject.field ||
        fieldObject.key ||
        rawField
    );

  if (!rawName) {
    return null;
  }

  const name =
    normalizeDynamicFieldName(
      rawName
    );

  if (!name) {
    return null;
  }

  const explicitlyRequired =
    fieldObject.required ===
      true;

  const explicitlyOptional =
    fieldObject.required ===
      false;

  const required =
    explicitlyRequired ||
    (
      !explicitlyOptional &&
      (
        requiredNames.has(
          rawName
        ) ||
        requiredNames.has(
          name
        )
      )
    );

  const type =
    normalizeLower(
      fieldObject.type
    ) ||
    (
      name === "phone"
        ? "tel"
        : "text"
    );

  const normalizedField = {
    name,

    label:
      normalizeString(
        fieldObject.label
      ) ||
      buildFieldLabel(
        name
      ),

    type,

    required:
      required &&
      !optionalNames.has(
        rawName
      ) &&
      !optionalNames.has(
        name
      )
  };

  const placeholder =
    normalizeString(
      fieldObject.placeholder
    );

  if (placeholder) {
    normalizedField.placeholder =
      placeholder;
  }

  return normalizedField;
}

export function normalizeSelectedFieldSchema(
  fieldSchema
) {
  if (!fieldSchema) {
    return [];
  }

  if (
    Array.isArray(
      fieldSchema
    )
  ) {
    return fieldSchema
      .map(rawField =>
        normalizeDynamicSchemaField({
          rawField,

          requiredNames:
            new Set(),

          optionalNames:
            new Set()
        })
      )
      .filter(Boolean);
  }

  if (
    typeof fieldSchema !==
      "object"
  ) {
    return [];
  }

  const requiredNames =
    new Set(
      normalizeFieldNameList(
        fieldSchema.required
      )
    );

  const optionalNames =
    new Set(
      normalizeFieldNameList(
        fieldSchema.optional
      )
    );

  let rawFields =
    normalizeArray(
      fieldSchema.fields
    );

  if (
    rawFields.length ===
      0
  ) {
    rawFields = [
      ...requiredNames,
      ...optionalNames
    ];
  }

  const fieldsByName =
    new Map();

  for (
    const rawField
    of rawFields
  ) {
    const field =
      normalizeDynamicSchemaField({
        rawField,
        requiredNames,
        optionalNames
      });

    if (
      !field ||
      fieldsByName.has(
        field.name
      )
    ) {
      continue;
    }

    fieldsByName.set(
      field.name,
      field
    );
  }

  return Array.from(
    fieldsByName.values()
  );
}

export function resolveSelectedOption({
  options,
  value
}) {
  const normalizedValue =
    normalizeString(
      value
    );

  if (!normalizedValue) {
    return null;
  }

  return (
    normalizeArray(
      options
    ).find(
      option =>
        normalizeString(
          option?.value
        ) ===
        normalizedValue
    ) ||
    null
  );
}

export function resolveOptionDynamicFields({
  field,
  option
}) {
  if (
    !field ||
    !option
  ) {
    return [];
  }

  const schemaKey =
    resolveFieldSchemaKey(
      field
    );

  if (!schemaKey) {
    return [];
  }

  const fieldSchema =
    option
      ?.raw
      ?.[
        schemaKey
      ];

  return normalizeSelectedFieldSchema(
    fieldSchema
  );
}
