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

function normalizeString(value) {
  return String(value || "").trim();
}

function escapeHtml(value) {
  return normalizeString(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getEl(id) {
  return document.getElementById(id);
}

function resolveFieldType(field = {}) {
  const type =
    normalizeString(field.type).toLowerCase();

  if (
    type === "email" ||
    type === "tel" ||
    type === "number"
  ) {
    return type;
  }

  return "text";
}

export function readDestinationFieldValues() {
  const values = {};

  getEl("destinationFields")
    ?.querySelectorAll("input, select, textarea")
    .forEach((el) => {
      const name =
        normalizeString(el.name);

      if (name) {
        values[name] = el.value;
      }
    });

  return values;
}

export function restoreDestinationFieldValues(values = {}) {
  getEl("destinationFields")
    ?.querySelectorAll("input, select, textarea")
    .forEach((el) => {
      const name =
        normalizeString(el.name);

      if (
        name &&
        Object.prototype.hasOwnProperty.call(values, name)
      ) {
        el.value = values[name];
      }
    });
}

export function clearDestinationErrors() {
  getEl("destinationFields")
    ?.querySelectorAll("input, select, textarea")
    .forEach((el) => {
      clearFieldError(el);
    });
}

export function markDestinationFieldInvalid(name, message) {
  const fieldName =
    normalizeString(name);

  const input =
    getEl(`destination_${fieldName}`);

  markFieldInvalid(
    input,
    message
  );
}

function bindClearErrorOnEdit(container) {
  container
    ?.querySelectorAll("input, select, textarea")
    .forEach((el) => {
      el.addEventListener("input", () => {
        clearFieldError(el);
      });

      el.addEventListener("change", () => {
        clearFieldError(el);
      });
    });
}

export function renderDestinationFields({
  availableRoutes = [],
  selectedRouteId = "",
  getSelectedRoute,
  onChange
} = {}) {
  const container =
    getEl("destinationFields");

  if (!container) {
    return;
  }

  const previousValues =
    readDestinationFieldValues();

  if (!availableRoutes.length || !selectedRouteId) {
    container.innerHTML = "";
    resetProviderDestinations();
    return;
  }

  const route =
    getSelectedRoute();

  if (
    renderProviderDestination({
      container,
      route,
      onChange
    })
  ) {
    return;
  }

  resetProviderDestinations();

  const fields =
    route.required_destination_fields || [];

  container.innerHTML =
    fields
      .map((field) => {
        const name =
          normalizeString(field.name);

        if (!name) {
          return "";
        }

        return `
          <label class="field">
            <span>${escapeHtml(field.label || name)}</span>
            <input
              id="destination_${escapeHtml(name)}"
              name="${escapeHtml(name)}"
              type="${escapeHtml(resolveFieldType(field))}"
              ${field.required !== false ? "required" : ""}
            />
          </label>
        `;
      })
      .join("");

  restoreDestinationFieldValues(
    previousValues
  );

  bindClearErrorOnEdit(
    container
  );
}

export function collectDestination(route = {}) {
  clearDestinationErrors();

  const providerDestination =
    collectProviderDestination(route);

  if (providerDestination) {
    return providerDestination;
  }

  const destination = {};

  for (const field of route.required_destination_fields || []) {
    const name =
      normalizeString(field.name);

    if (!name) {
      continue;
    }

    const input =
      getEl(`destination_${name}`);

    const value =
      normalizeString(input?.value);

    if (field.required !== false && !value) {
      const code =
        `destination_field_required_${name}`;

      const message =
        `${field.label || name} is required.`;

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

    if (value) {
      destination[name] = value;
    }
  }

  if (
    route.destination_required !== false &&
    route.required_destination_fields?.length &&
    !Object.keys(destination).length
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

  return destination;
}
