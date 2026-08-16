// pay-by-bank/js/ui/routeSummary.js

import {
  getRequiredElements
} from "./elements.js";

import {
  setHidden
} from "./dom.js";


export function renderRouteSummary({
  sourceCountry,
  receiverCountry,
  method =
    "Bank transfer"
} = {}) {
  const {
    routeSummary
  } =
    getRequiredElements();

  const normalizedSource =
    String(
      sourceCountry || ""
    )
      .trim()
      .toUpperCase();

  const normalizedReceiver =
    String(
      receiverCountry || ""
    )
      .trim()
      .toUpperCase();

  routeSummary.replaceChildren();

  const grid =
    document.createElement(
      "div"
    );

  grid.className =
    "summary-grid";

  const items = [
    {
      label:
        "Paying from",

      value:
        normalizedSource ||
        "—"
    },
    {
      label:
        "Sending to",

      value:
        normalizedReceiver ||
        "—"
    },
    {
      label:
        "Method",

      value:
        String(
          method ||
          "Bank transfer"
        )
    }
  ];

  for (
    const item of
    items
  ) {
    const row =
      document.createElement(
        "div"
      );

    row.className =
      "summary-item";

    const label =
      document.createElement(
        "span"
      );

    label.textContent =
      item.label;

    const value =
      document.createElement(
        "strong"
      );

    value.textContent =
      item.value;

    row.append(
      label,
      value
    );

    grid.appendChild(
      row
    );
  }

  routeSummary.appendChild(
    grid
  );

  setHidden(
    routeSummary,
    false
  );
}


export function hideRouteSummary() {
  const {
    routeSummary
  } =
    getRequiredElements();

  routeSummary.replaceChildren();

  setHidden(
    routeSummary,
    true
  );
}
