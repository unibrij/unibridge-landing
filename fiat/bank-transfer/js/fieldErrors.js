// fiat/bank-transfer/js/fieldErrors.js

function normalizeString(value) {
  return String(value || "").trim();
}

function resolveField(input) {
  if (!input) {
    return null;
  }

  if (typeof input === "string") {
    return document.getElementById(input);
  }

  return input;
}

function resolveErrorElement(input) {
  const field =
    resolveField(input);

  if (!field) {
    return null;
  }

  const wrapper =
    field.closest(".field") ||
    field.parentElement;

  if (!wrapper) {
    return null;
  }

  let error =
    wrapper.querySelector(".field-error-message");

  if (!error) {
    error =
      document.createElement("small");

    error.className =
      "field-error-message";

    wrapper.appendChild(error);
  }

  return error;
}

export function clearFieldError(input) {
  const field =
    resolveField(input);

  if (!field) {
    return;
  }

  field.removeAttribute("aria-invalid");
  field.classList.remove("field-invalid");
  field.style.borderColor = "";
  field.style.boxShadow = "";

  const wrapper =
    field.closest(".field") ||
    field.parentElement;

  const error =
    wrapper?.querySelector(".field-error-message");

  if (error) {
    error.remove();
  }
}

export function markFieldInvalid(input, message) {
  const field =
    resolveField(input);

  if (!field) {
    return;
  }

  const text =
    normalizeString(message) ||
    "This field is required.";

  field.setAttribute("aria-invalid", "true");
  field.classList.add("field-invalid");
  field.style.borderColor = "rgba(248, 113, 113, 0.85)";
  field.style.boxShadow = "0 0 0 3px rgba(248, 113, 113, 0.16)";

  const error =
    resolveErrorElement(field);

  if (error) {
    error.textContent = text;
    error.style.color = "#ff8f8f";
    error.style.fontSize = "11px";
    error.style.lineHeight = "1.35";
  }

  field.focus({ preventScroll: true });
  field.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

export function createHandledFieldError({
  code,
  field,
  message
} = {}) {
  const error =
    new Error(
      normalizeString(message) ||
      normalizeString(code) ||
      "field_required"
    );

  error.handled = true;
  error.code =
    normalizeString(code) ||
    "field_required";
  error.field =
    normalizeString(field) ||
    null;

  return error;
}
