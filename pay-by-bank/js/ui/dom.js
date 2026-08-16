// pay-by-bank/js/ui/dom.js

export function setHidden(
  element,
  hidden
) {
  element.classList.toggle(
    "hidden",
    Boolean(hidden)
  );
}


export function setButtonBusy(
  button,
  busy,
  busyLabel,
  idleLabel
) {
  button.disabled =
    Boolean(busy);

  if (busy) {
    button.textContent =
      busyLabel;

    return;
  }

  if (idleLabel) {
    button.textContent =
      idleLabel;
  }
}


export function clearFieldError(
  field
) {
  field.classList.remove(
    "field-invalid"
  );

  const wrapper =
    field.closest(
      ".field"
    );

  if (!wrapper) {
    return;
  }

  wrapper
    .querySelector(
      ".field-error-message"
    )
    ?.remove();
}


export function showFieldError(
  field,
  message
) {
  clearFieldError(
    field
  );

  field.classList.add(
    "field-invalid"
  );

  const wrapper =
    field.closest(
      ".field"
    );

  if (!wrapper) {
    return;
  }

  const error =
    document.createElement(
      "span"
    );

  error.className =
    "field-error-message";

  error.textContent =
    String(
      message || ""
    );

  wrapper.appendChild(
    error
  );
}
