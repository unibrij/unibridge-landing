// unibridge-landing/receive/receive-fields.js

import {
  loadReceiveFieldOptions
} from "./receive-api.js";

import {
  formatRailLabel
} from "./receive-catalog.js";


const BLOCKED_FIELD_NAMES =
  new Set([
    "__proto__",
    "prototype",
    "constructor"
  ]);

const renderVersions =
  new WeakMap();


function normalizeString(value) {
  return String(value ?? "").trim();
}

function normalizeLower(value) {
  return normalizeString(value).toLowerCase();
}

function isPlainObject(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function isSafeFieldName(value) {
  const name =
    normalizeString(value);

  return Boolean(
    name &&
    !BLOCKED_FIELD_NAMES.has(name)
  );
}


function normalizeOption(
  option,
  {
    valueField = "value",
    labelField = "label"
  } = {}
) {
  if (typeof option === "string") {
    const value =
      normalizeString(option);

    return value
      ? {
          value,
          label: value
        }
      : null;
  }

  if (!isPlainObject(option)) {
    return null;
  }

  const value =
    normalizeString(
      option[valueField] ??
      option.value ??
      option.id ??
      option.key ??
      option.code
    );

  if (!value) {
    return null;
  }

  const label =
    normalizeString(
      option[labelField] ??
      option.label ??
      option.name ??
      option.bankName ??
      value
    );

  return {
    value,
    label: label || value
  };
}


function extractOptionList(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isPlainObject(payload)) {
    return [];
  }

  const directCandidates = [
    payload.options,
    payload.banks,
    payload.channels,
    payload.results,
    payload.data
  ];

  for (const candidate of directCandidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  if (!isPlainObject(payload.data)) {
    return [];
  }

  const nestedCandidates = [
    payload.data.options,
    payload.data.banks,
    payload.data.channels,
    payload.data.results
  ];

  for (const candidate of nestedCandidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}


async function resolveFieldOptions(field = {}) {
  if (Array.isArray(field.options)) {
    return field.options
      .map(option =>
        normalizeOption(option)
      )
      .filter(Boolean);
  }

  if (Array.isArray(field.values)) {
    return field.values
      .map(option =>
        normalizeOption(option)
      )
      .filter(Boolean);
  }

  if (!isPlainObject(field.options)) {
    return [];
  }

  const endpoint =
    normalizeString(
      field.options.endpoint
    );

  if (!endpoint) {
    return [];
  }

  const payload =
    await loadReceiveFieldOptions(
      endpoint
    );

  const valueField =
    normalizeString(
      field.options.value_field
    ) ||
    "value";

  const labelField =
    normalizeString(
      field.options.label_field
    ) ||
    "label";

  return extractOptionList(payload)
    .map(option =>
      normalizeOption(
        option,
        {
          valueField,
          labelField
        }
      )
    )
    .filter(Boolean);
}


function fieldUsesSelect(field = {}) {
  if (
    normalizeLower(field.type) ===
    "select"
  ) {
    return true;
  }

  if (
    Array.isArray(field.options) ||
    Array.isArray(field.values)
  ) {
    return true;
  }

  return Boolean(
    isPlainObject(field.options) &&
    normalizeString(
      field.options.endpoint
    )
  );
}


function resolveInputType(field = {}) {
  const type =
    normalizeLower(field.type);

  switch (type) {
    case "email":
    case "tel":
    case "date":
    case "number":
    case "text":
      return type;

    default:
      return "text";
  }
}


function getValidation(field = {}) {
  return isPlainObject(
    field.validation
  )
    ? field.validation
    : {};
}


function configureControl(
  control,
  field = {}
) {
  const name =
    normalizeString(field.name);

  control.name =
    name;

  control.dataset.receiveField =
    name;

  control.required =
    field.required === true;

  const placeholder =
    normalizeString(
      field.placeholder
    );

  if (
    placeholder &&
    "placeholder" in control
  ) {
    control.placeholder =
      placeholder;
  }

  const validation =
    getValidation(field);

  const minLength =
    Number(
      validation.min_length ??
      validation.minLength
    );

  if (
    Number.isFinite(minLength) &&
    minLength > 0 &&
    "minLength" in control
  ) {
    control.minLength =
      minLength;
  }

  const maxLength =
    Number(
      validation.max_length ??
      validation.maxLength
    );

  if (
    Number.isFinite(maxLength) &&
    maxLength > 0 &&
    "maxLength" in control
  ) {
    control.maxLength =
      maxLength;
  }

  const pattern =
    normalizeString(
      validation.pattern ??
      validation.regex
    );

  if (
    pattern &&
    "pattern" in control
  ) {
    control.pattern =
      pattern;
  }
}


function createFieldWrapper(field = {}) {
  const wrapper =
    document.createElement(
      "label"
    );

  wrapper.className =
    "receive-field";

  const label =
    document.createElement(
      "span"
    );

  label.className =
    "receive-field-label";

  label.textContent =
    normalizeString(
      field.label
    ) ||
    formatRailLabel(
      field.name
    );

  wrapper.appendChild(
    label
  );

  return wrapper;
}


function createTextControl(field = {}) {
  const input =
    document.createElement(
      "input"
    );

  input.type =
    resolveInputType(field);

  configureControl(
    input,
    field
  );

  return input;
}


async function createSelectControl(
  field = {}
) {
  const select =
    document.createElement(
      "select"
    );

  configureControl(
    select,
    field
  );

  const options =
    await resolveFieldOptions(
      field
    );

  const placeholder =
    document.createElement(
      "option"
    );

  placeholder.value =
    "";

  placeholder.textContent =
    normalizeString(
      field.placeholder
    ) ||
    "Select";

  select.appendChild(
    placeholder
  );

  for (const option of options) {
    const element =
      document.createElement(
        "option"
      );

    element.value =
      option.value;

    element.textContent =
      option.label;

    select.appendChild(
      element
    );
  }

  return select;
}


async function createFieldControl(
  field = {}
) {
  if (fieldUsesSelect(field)) {
    return createSelectControl(
      field
    );
  }

  return createTextControl(
    field
  );
}


function nextRenderVersion(root) {
  const version =
    (
      renderVersions.get(root) ||
      0
    ) + 1;

  renderVersions.set(
    root,
    version
  );

  return version;
}


function isCurrentRender(
  root,
  version
) {
  return (
    renderVersions.get(root) ===
    version
  );
}


export function cancelReceiveFieldRender(
  root
) {
  if (!root) {
    return;
  }

  nextRenderVersion(
    root
  );
}


export async function renderReceiveFields({
  root,
  route
} = {}) {
  if (!root) {
    return;
  }

  const version =
    nextRenderVersion(root);

  const fragment =
    document.createDocumentFragment();

  const fields =
    Array.isArray(
      route?.input_fields
    )
      ? route.input_fields
      : [];

  for (const field of fields) {
    const name =
      normalizeString(
        field?.name
      );

    if (!isSafeFieldName(name)) {
      continue;
    }

    const wrapper =
      createFieldWrapper(
        field
      );

    const control =
      await createFieldControl(
        field
      );

    if (
      !isCurrentRender(
        root,
        version
      )
    ) {
      return;
    }

    wrapper.appendChild(
      control
    );

    fragment.appendChild(
      wrapper
    );
  }

  if (
    !isCurrentRender(
      root,
      version
    )
  ) {
    return;
  }

  root.replaceChildren(
    fragment
  );
}


export function collectReceiveBeneficiary(
  root
) {
  const beneficiary =
    Object.create(null);

  const controls =
    root?.querySelectorAll(
      "[data-receive-field]"
    ) ||
    [];

  let firstInvalid =
    null;

  for (const control of controls) {
    control.classList.remove(
      "field-invalid"
    );

    const name =
      normalizeString(
        control.dataset
          .receiveField
      );

    if (!isSafeFieldName(name)) {
      continue;
    }

    const value =
      normalizeString(
        control.value
      );

    const missingRequired =
      control.required &&
      !value;

    const invalidValue =
      Boolean(
        value &&
        typeof control.checkValidity ===
          "function" &&
        !control.checkValidity()
      );

    if (
      missingRequired ||
      invalidValue
    ) {
      control.classList.add(
        "field-invalid"
      );

      firstInvalid ||=
        control;

      continue;
    }

    if (value) {
      beneficiary[name] =
        value;
    }
  }

  if (firstInvalid) {
    firstInvalid.focus();

    throw new Error(
      "Please complete all required receiving details correctly."
    );
  }

  return {
    ...beneficiary
  };
}
