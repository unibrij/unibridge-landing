// shared/pay/destination/fields.js

import {
  getRouteDestinationFields
} from "./schema.js";


function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}


function isObject(
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

function normalizeOption(
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
      option
  };
}


function normalizeOptions(
  options
) {
  if (!Array.isArray(options)) {
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


function staticOptionsOf(
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

function dependentFieldsOf(
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

    schema:
      raw.schema,

    fields:
      raw.fields
  });
}


/*
--------------------------------------------------
DOM helpers
--------------------------------------------------
*/

function createElement(
  tag,
  className = ""
) {
  const element =
    document.createElement(
      tag
    );

  if (className) {
    element.className =
      className;
  }

  return element;
}


function createLabel(
  field
) {
  const label =
    createElement(
      "label",
      "destination-field-label"
    );

  label.textContent =
    field.label ||
    field.name;

  if (
    field.required !==
    false
  ) {
    const required =
      createElement(
        "span",
        "destination-field-required"
      );

    required.textContent =
      " *";

    label.appendChild(
      required
    );
  }

  return label;
}


function applyCommonAttributes(
  input,
  field
) {
  input.name =
    field.name;

  input.dataset.destinationField =
    "1";

  input.dataset.destinationFieldName =
    field.name;

  if (
    field.required !==
    false
  ) {
    input.required =
      true;
  }

  const placeholder =
    normalizeString(
      field.placeholder
    );

  if (
    placeholder &&
    input.tagName !==
      "SELECT"
  ) {
    input.placeholder =
      placeholder;
  }

  if (
    field.autocomplete
  ) {
    input.autocomplete =
      String(
        field.autocomplete
      );
  }

  if (
    field.inputmode
  ) {
    input.inputMode =
      String(
        field.inputmode
      );
  }

  if (
    field.pattern
  ) {
    input.pattern =
      String(
        field.pattern
      );
  }

  if (
    field.minlength !==
    undefined
  ) {
    input.minLength =
      Number(
        field.minlength
      );
  }

  if (
    field.maxlength !==
    undefined
  ) {
    input.maxLength =
      Number(
        field.maxlength
      );
  }
}


function createInput(
  field
) {
  const input =
    createElement(
      "input",
      "destination-field-input"
    );

  const type =
    normalizeString(
      field.type
    ).toLowerCase();

  input.type =
    (
      type === "email" ||
      type === "tel" ||
      type === "number" ||
      type === "date"
    )
      ? type
      : "text";

  applyCommonAttributes(
    input,
    field
  );

  return input;
}


function createSelect(
  field,
  options = []
) {
  const select =
    createElement(
      "select",
      "destination-field-input destination-field-select"
    );

  applyCommonAttributes(
    select,
    field
  );

  const placeholder =
    createElement(
      "option"
    );

  placeholder.value =
    "";

  placeholder.textContent =
    normalizeString(
      field.placeholder ||
      field.option_placeholder
    ) ||
    `Select ${field.label || field.name}`;

  placeholder.disabled =
    field.required !==
    false;

  placeholder.selected =
    true;

  select.appendChild(
    placeholder
  );

  for (
    const option of
      options
  ) {
    const element =
      createElement(
        "option"
      );

    element.value =
      option.value;

    element.textContent =
      option.label;

    element.__destinationOption =
      option;

    select.appendChild(
      element
    );
  }

  return select;
}


/*
--------------------------------------------------
Field rendering
--------------------------------------------------
*/

async function resolveFieldOptions({
  field,
  resolveOptions,
  values
}) {
  const staticOptions =
    staticOptionsOf(
      field
    );

  if (
    staticOptions.length
  ) {
    return staticOptions;
  }

  if (
    typeof resolveOptions !==
    "function"
  ) {
    return [];
  }

  const result =
    await resolveOptions({
      field,

      values: {
        ...values
      }
    });

  return normalizeOptions(
    result
  );
}


async function renderField({
  container,
  field,
  resolveOptions,
  values,
  onChange
}) {
  const wrapper =
    createElement(
      "div",
      "destination-field"
    );

  wrapper.dataset.destinationFieldWrapper =
    field.name;

  const label =
    createLabel(
      field
    );

  wrapper.appendChild(
    label
  );

  const options =
    await resolveFieldOptions({
      field,
      resolveOptions,
      values
    });

  const shouldUseSelect =
    options.length >
      0 ||
    normalizeString(
      field.type
    ).toLowerCase() ===
      "select";

  const input =
    shouldUseSelect
      ? createSelect(
          field,
          options
        )
      : createInput(
          field
        );

  wrapper.appendChild(
    input
  );


  /*
  ------------------------------------------------
  Dependent schema mount
  ------------------------------------------------
  */

  const dependentContainer =
    createElement(
      "div",
      "destination-dependent-fields"
    );

  wrapper.appendChild(
    dependentContainer
  );


  async function handleChange() {
    values[field.name] =
      input.value;


    /*
    ------------------------------------------------
    Remove stale dependent values before rebuilding
    ------------------------------------------------
    */

    dependentContainer
      .querySelectorAll(
        "[data-destination-field='1']"
      )
      .forEach(
        dependentField => {
          const dependentName =
            normalizeString(
              dependentField.name ||
              dependentField.dataset
                ?.destinationFieldName
            );

          if (dependentName) {
            delete values[
              dependentName
            ];
          }
        }
      );


    dependentContainer
      .replaceChildren();


    /*
    ------------------------------------------------
    Render dependent schema for selected option
    ------------------------------------------------
    */

    if (
      input.tagName ===
      "SELECT"
    ) {
      const selected =
        input.options[
          input.selectedIndex
        ];

      const option =
        selected
          ?.__destinationOption;

      const dependentFields =
        dependentFieldsOf(
          option
        );

      if (
        dependentFields.length
      ) {
        await renderFields({
          container:
            dependentContainer,

          fields:
            dependentFields,

          resolveOptions,
          values,
          onChange
        });
      }
    }


    if (
      typeof onChange ===
      "function"
    ) {
      onChange({
        name:
          field.name,

        value:
          input.value,

        field
      });
    }
  }


  /*
  ------------------------------------------------
  Change lifecycle

  Keep the active async change promise on the field
  so prefill can wait until dependent fields exist.
  ------------------------------------------------
  */

  input.addEventListener(
    "change",
    () => {
      const changePromise =
        handleChange()
          .catch(
            error => {
              console.error(
                "DESTINATION_FIELD_CHANGE_FAILED",
                error
              );
            }
          );

      input.__destinationChangePromise =
        changePromise;

      changePromise
        .finally(
          () => {
            if (
              input
                .__destinationChangePromise ===
              changePromise
            ) {
              input
                .__destinationChangePromise =
                null;
            }
          }
        );
    }
  );


  input.addEventListener(
    "input",
    () => {
      values[field.name] =
        input.value;
    }
  );


  container.appendChild(
    wrapper
  );
}


/*
--------------------------------------------------
Recursive renderer
--------------------------------------------------
*/

async function renderFields({
  container,
  fields,
  resolveOptions,
  values,
  onChange
}) {
  for (
    const field of
      fields
  ) {
    await renderField({
      container,
      field,
      resolveOptions,
      values,
      onChange
    });
  }
}


/*
--------------------------------------------------
Public render
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
Collect
--------------------------------------------------
*/

export function collectDestination({
  container
} = {}) {
  if (!container) {
    return {};
  }

  const beneficiary =
    {};

  const fields =
    container.querySelectorAll(
      "[data-destination-field='1']"
    );

  for (
    const field of
      fields
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


    if (
      field.type ===
      "checkbox"
    ) {
      beneficiary[name] =
        Boolean(
          field.checked
        );

      continue;
    }


    const value =
      normalizeString(
        field.value
      );

    if (
      value !==
      ""
    ) {
      beneficiary[name] =
        value;
    }
  }

  return beneficiary;
}


/*
--------------------------------------------------
Prefill
--------------------------------------------------
*/

export async function prefillDestination({
  container,
  beneficiary
} = {}) {
  if (
    !container ||
    !isObject(
      beneficiary
    )
  ) {
    return;
  }


  for (
    const [
      name,
      value
    ] of
      Object.entries(
        beneficiary
      )
  ) {
    if (
      value ===
        undefined ||
      value ===
        null
    ) {
      continue;
    }


    const field =
      container.querySelector(
        `[data-destination-field-name="${CSS.escape(
          name
        )}"]`
      );

    if (!field) {
      continue;
    }


    field.value =
      String(
        value
      );


    field.dispatchEvent(
      new Event(
        "input",
        {
          bubbles:
            true
        }
      )
    );


    field.dispatchEvent(
      new Event(
        "change",
        {
          bubbles:
            true
        }
      )
    );


    /*
    ------------------------------------------------
    A select change may asynchronously render its
    dependent fields. Wait for that render before
    attempting to prefill the next beneficiary field.
    ------------------------------------------------
    */

    if (
      field
        .__destinationChangePromise
    ) {
      await field
        .__destinationChangePromise;
    }
  }
}


/*
--------------------------------------------------
Clear
--------------------------------------------------
*/

export function clearDestinationFields({
  container
} = {}) {
  if (!container) {
    return;
  }

  container.replaceChildren();
}
