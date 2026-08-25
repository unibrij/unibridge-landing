// shared/pay/destination/fieldRenderer.js

import {
  dependentFieldsOf,
  normalizeOptions,
  normalizeString,
  staticOptionsOf
} from "./fieldModel.js";

import {
  createDestinationSelect
} from "./selectRenderer.js";


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
Field type
--------------------------------------------------
*/

function shouldRenderSelect({
  field,
  options
}) {
  if (
    Array.isArray(options) &&
    options.length
  ) {
    return true;
  }

  return (
    normalizeString(
      field.type
    ).toLowerCase() ===
    "select"
  );
}


/*
--------------------------------------------------
Change lifecycle
--------------------------------------------------
*/

function bindChangeHandler({
  input,
  handleChange
}) {
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


  const useSelect =
    shouldRenderSelect({
      field,
      options
    });


  let input =
    null;

  let getSelectedOption =
    () => null;


  if (useSelect) {
    const select =
      createDestinationSelect({
        field,
        options,

        applyCommonAttributes
      });

    input =
      select.input;

    getSelectedOption =
      select.getSelectedOption;

    wrapper.appendChild(
      select.element
    );
  } else {
    input =
      createInput(
        field
      );

    wrapper.appendChild(
      input
    );
  }


  const dependentContainer =
    createElement(
      "div",
      "destination-dependent-fields"
    );

  wrapper.appendChild(
    dependentContainer
  );


  let changeGeneration =
    0;


  async function handleChange() {
    const generation =
      ++changeGeneration;

    values[field.name] =
      input.value;


    clearDependentValues({
      container:
        dependentContainer,

      values
    });


    dependentContainer
      .replaceChildren();


    if (useSelect) {
      const option =
        getSelectedOption();


      const dependentFields =
        dependentFieldsOf(
          option
        );


      if (
        dependentFields.length
      ) {
        const stagingContainer =
          document.createElement(
            "div"
          );


        await renderFields({
          container:
            stagingContainer,

          fields:
            dependentFields,

          resolveOptions,
          values,
          onChange
        });


        if (
          generation !==
          changeGeneration
        ) {
          return;
        }


        dependentContainer
          .replaceChildren(
            ...stagingContainer.childNodes
          );
      }
    }


    if (
      generation !==
      changeGeneration
    ) {
      return;
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


  bindChangeHandler({
    input,
    handleChange
  });


  if (!useSelect) {
    input.addEventListener(
      "input",
      () => {
        values[field.name] =
          input.value;
      }
    );
  }


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
