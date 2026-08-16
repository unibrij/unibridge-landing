// pay-by-bank/js/ui/status.js

import {
  getRequiredElements
} from "./elements.js";

import {
  setHidden
} from "./dom.js";


export function setStatus(
  message,
  {
    error = false
  } = {}
) {
  const {
    statusBox
  } =
    getRequiredElements();

  statusBox.textContent =
    String(
      message || ""
    );

  statusBox.classList.toggle(
    "is-error",
    Boolean(error)
  );

  setHidden(
    statusBox,
    false
  );
}


export function clearStatus() {
  const {
    statusBox
  } =
    getRequiredElements();

  statusBox.textContent =
    "";

  statusBox.classList.remove(
    "is-error"
  );

  setHidden(
    statusBox,
    true
  );
}
