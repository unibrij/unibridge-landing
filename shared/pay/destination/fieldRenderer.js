// shared/pay/destination/fieldRenderer.js

import {
  dependentFieldsOf,
  normalizeOptions,
  normalizeString,
  staticOptionsOf
} from "./fieldModel.js";


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
Options
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


/*
--------------------------------------------------
Dependent values
--------------------------------------------------
*/

function clearDependentValues({
  container,
  values
}) {
  container
    .querySelectorAll(
      "[data-destination-field='1']"
    )
    .forEach(
      dependentField => {
        const name =
          normalizeString(
            dependentField.name ||
            dependentField.dataset
              ?.destinationFieldName
          );

        if (name) {
          delete values[
            name
          ];
        }
      }
    );
}


/*
--------------------------------------------------
Field renderer
--------------------------------------------------
*/

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


  wrapper.appendChild(
    createLabel(
      field
    )
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


    clearDependentValues({
      container:
        dependentContainer,

      values
    });


    dependentContainer
      .replaceChildren();


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

export async function renderFields({
  container,
  fields,
  resolveOptions,
  values,
  onChange
} = {}) {
  if (
    !container ||
    !Array.isArray(
      fields
    )
  ) {
    return;
  }


  for (
    const field of
      fields
  ) {
    if (
      !field ||
      typeof field !==
        "object" ||
      !normalizeString(
        field.name
      )
    ) {
      continue;
    }


    await renderField({
      container,
      field,
      resolveOptions,
      values,
      onChange
    });
  }
}
