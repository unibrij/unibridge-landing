// pay-by-bank/js/ui.js

const elements = {
  sourceCountry:
    document.getElementById(
      "sourceCountry"
    ),

  receiverCountry:
    document.getElementById(
      "receiverCountry"
    ),

  amount:
    document.getElementById(
      "amount"
    ),

  amountCurrency:
    document.getElementById(
      "amountCurrency"
    ),

  entryBox:
    document.getElementById(
      "entryBox"
    ),

  prepareBox:
    document.getElementById(
      "prepareBox"
    ),

  routeSummary:
    document.getElementById(
      "routeSummary"
    ),

  pricingPreviewMount:
    document.getElementById(
      "pricingPreviewMount"
    ),

  statusBox:
    document.getElementById(
      "statusBox"
    ),

  continueAction:
    document.getElementById(
      "continueAction"
    ),

  confirmAction:
    document.getElementById(
      "confirmAction"
    ),

  primaryAction:
    document.getElementById(
      "primaryAction"
    ),

  backAction:
    document.getElementById(
      "backAction"
    )
};


function requireElement(
  element,
  name
) {
  if (!element) {
    throw new Error(
      `missing_pay_by_bank_ui_element:${name}`
    );
  }

  return element;
}


function getRequiredElements() {
  return {
    sourceCountry:
      requireElement(
        elements.sourceCountry,
        "sourceCountry"
      ),

    receiverCountry:
      requireElement(
        elements.receiverCountry,
        "receiverCountry"
      ),

    amount:
      requireElement(
        elements.amount,
        "amount"
      ),

    amountCurrency:
      requireElement(
        elements.amountCurrency,
        "amountCurrency"
      ),

    entryBox:
      requireElement(
        elements.entryBox,
        "entryBox"
      ),

    prepareBox:
      requireElement(
        elements.prepareBox,
        "prepareBox"
      ),

    routeSummary:
      requireElement(
        elements.routeSummary,
        "routeSummary"
      ),

    pricingPreviewMount:
      requireElement(
        elements.pricingPreviewMount,
        "pricingPreviewMount"
      ),

    statusBox:
      requireElement(
        elements.statusBox,
        "statusBox"
      ),

    continueAction:
      requireElement(
        elements.continueAction,
        "continueAction"
      ),

    confirmAction:
      requireElement(
        elements.confirmAction,
        "confirmAction"
      ),

    primaryAction:
      requireElement(
        elements.primaryAction,
        "primaryAction"
      ),

    backAction:
      requireElement(
        elements.backAction,
        "backAction"
      )
  };
}


function setHidden(
  element,
  hidden
) {
  element.classList.toggle(
    "hidden",
    Boolean(hidden)
  );
}


function setButtonBusy(
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
  } else if (idleLabel) {
    button.textContent =
      idleLabel;
  }
}


function clearFieldError(
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

  const existing =
    wrapper.querySelector(
      ".field-error-message"
    );

  existing?.remove();
}


function showFieldError(
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


function normalizeCountryOptions(
  countries = []
) {
  if (
    !Array.isArray(
      countries
    )
  ) {
    return [];
  }

  return countries
    .map(country => {
      if (
        typeof country ===
        "string"
      ) {
        const code =
          country
            .trim()
            .toUpperCase();

        return code
          ? {
              code,
              label:
                code
            }
          : null;
      }

      if (
        !country ||
        typeof country !==
        "object"
      ) {
        return null;
      }

      const code =
        String(
          country.code ||
          country.value ||
          ""
        )
          .trim()
          .toUpperCase();

      if (!code) {
        return null;
      }

      const label =
        String(
          country.label ||
          country.name ||
          code
        ).trim();

      return {
        code,

        label:
          label ||
          code
      };
    })
    .filter(Boolean);
}


function populateCountrySelect(
  select,
  countries = [],
  {
    placeholder =
      "Select country"
  } = {}
) {
  const options =
    normalizeCountryOptions(
      countries
    );

  select.replaceChildren();

  const placeholderOption =
    document.createElement(
      "option"
    );

  placeholderOption.value =
    "";

  placeholderOption.textContent =
    placeholder;

  placeholderOption.disabled =
    true;

  placeholderOption.selected =
    true;

  select.appendChild(
    placeholderOption
  );

  for (
    const country of
    options
  ) {
    const option =
      document.createElement(
        "option"
      );

    option.value =
      country.code;

    option.textContent =
      country.label;

    select.appendChild(
      option
    );
  }
}


export function initializeUI({
  sourceCountries = [],
  receiverCountries = [],
  currency = "EUR"
} = {}) {
  const ui =
    getRequiredElements();

  populateSourceCountries(
    sourceCountries
  );

  populateReceiverCountries(
    receiverCountries
  );

  setCurrency(
    currency
  );

  showEntry();

  clearStatus();

  hideRouteSummary();

  hidePricingPreview();

  hideConfirmAction();

  setContinueBusy(
    false
  );

  setConfirmBusy(
    false
  );

  setPrimaryBusy(
    false
  );

  setPrimaryEnabled(
    false
  );

  resetSteps();

  return ui;
}


export function populateSourceCountries(
  countries = []
) {
  const {
    sourceCountry
  } =
    getRequiredElements();

  populateCountrySelect(
    sourceCountry,
    countries,
    {
      placeholder:
        "Select country"
    }
  );
}


export function populateReceiverCountries(
  countries = []
) {
  const {
    receiverCountry
  } =
    getRequiredElements();

  populateCountrySelect(
    receiverCountry,
    countries,
    {
      placeholder:
        "Select destination"
    }
  );
}


export function setCurrency(
  currency
) {
  const {
    amountCurrency
  } =
    getRequiredElements();

  const normalized =
    String(
      currency || "EUR"
    )
      .trim()
      .toUpperCase();

  amountCurrency.textContent =
    normalized ||
    "EUR";
}


export function readEntryForm() {
  const {
    sourceCountry,
    receiverCountry,
    amount
  } =
    getRequiredElements();

  return {
    sourceCountry:
      String(
        sourceCountry.value ||
        ""
      )
        .trim()
        .toUpperCase(),

    receiverCountry:
      String(
        receiverCountry.value ||
        ""
      )
        .trim()
        .toUpperCase(),

    amount:
      amount.value
  };
}


export function validateEntryForm() {
  const {
    sourceCountry,
    receiverCountry,
    amount
  } =
    getRequiredElements();

  clearFieldError(
    sourceCountry
  );

  clearFieldError(
    receiverCountry
  );

  clearFieldError(
    amount
  );

  let valid =
    true;

  const source =
    String(
      sourceCountry.value ||
      ""
    ).trim();

  if (!source) {
    showFieldError(
      sourceCountry,
      "Choose where you are paying from."
    );

    valid =
      false;
  }

  const receiver =
    String(
      receiverCountry.value ||
      ""
    ).trim();

  if (!receiver) {
    showFieldError(
      receiverCountry,
      "Choose where you are sending to."
    );

    valid =
      false;
  }

  const parsedAmount =
    Number(
      amount.value
    );

  if (
    !Number.isFinite(
      parsedAmount
    ) ||
    parsedAmount <= 0
  ) {
    showFieldError(
      amount,
      "Enter a valid amount."
    );

    valid =
      false;
  }

  return valid;
}


export function showEntry() {
  const {
    entryBox,
    prepareBox
  } =
    getRequiredElements();

  setHidden(
    entryBox,
    false
  );

  setHidden(
    prepareBox,
    true
  );
}


export function showPreparation() {
  const {
    entryBox,
    prepareBox
  } =
    getRequiredElements();

  setHidden(
    entryBox,
    true
  );

  setHidden(
    prepareBox,
    false
  );
}


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


/*
--------------------------------------------------
Shared pricing mount visibility

This module owns only the mount visibility.

Pricing content, parsing, formatting and semantics
must be owned by the shared Pay pricing module.
--------------------------------------------------
*/

export function getPricingPreviewMount() {
  const {
    pricingPreviewMount
  } =
    getRequiredElements();

  return pricingPreviewMount;
}


export function showPricingPreview() {
  const {
    pricingPreviewMount
  } =
    getRequiredElements();

  setHidden(
    pricingPreviewMount,
    false
  );
}


export function hidePricingPreview() {
  const {
    pricingPreviewMount
  } =
    getRequiredElements();

  setHidden(
    pricingPreviewMount,
    true
  );
}


export function clearPricingPreviewMount() {
  const {
    pricingPreviewMount
  } =
    getRequiredElements();

  pricingPreviewMount.replaceChildren();

  setHidden(
    pricingPreviewMount,
    true
  );
}


export function showConfirmAction() {
  const {
    confirmAction
  } =
    getRequiredElements();

  setHidden(
    confirmAction,
    false
  );
}


export function hideConfirmAction() {
  const {
    confirmAction
  } =
    getRequiredElements();

  setHidden(
    confirmAction,
    true
  );
}


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


export function setStepState(
  stepName,
  state
) {
  const step =
    document.querySelector(
      `.step[data-step="${stepName}"]`
    );

  if (!step) {
    return;
  }

  step.classList.remove(
    "is-active",
    "is-complete"
  );

  if (
    state ===
    "active"
  ) {
    step.classList.add(
      "is-active"
    );
  }

  if (
    state ===
    "complete"
  ) {
    step.classList.add(
      "is-complete"
    );
  }
}


export function resetSteps() {
  for (
    const step of
    document.querySelectorAll(
      ".step"
    )
  ) {
    step.classList.remove(
      "is-active",
      "is-complete"
    );
  }
}


export function setContinueBusy(
  busy
) {
  const {
    continueAction
  } =
    getRequiredElements();

  setButtonBusy(
    continueAction,
    busy,
    "Preparing preview…",
    "Review payment"
  );
}


export function setConfirmBusy(
  busy
) {
  const {
    confirmAction
  } =
    getRequiredElements();

  setButtonBusy(
    confirmAction,
    busy,
    "Preparing payment…",
    "Continue with bank"
  );
}


export function setConfirmEnabled(
  enabled
) {
  const {
    confirmAction
  } =
    getRequiredElements();

  confirmAction.disabled =
    !enabled;
}


export function setPrimaryBusy(
  busy
) {
  const {
    primaryAction
  } =
    getRequiredElements();

  setButtonBusy(
    primaryAction,
    busy,
    "Opening bank…",
    "Continue to bank"
  );
}


export function setPrimaryEnabled(
  enabled
) {
  const {
    primaryAction
  } =
    getRequiredElements();

  primaryAction.disabled =
    !enabled;
}


export function bindContinue(
  handler
) {
  const {
    continueAction
  } =
    getRequiredElements();

  continueAction.addEventListener(
    "click",
    handler
  );
}


export function bindConfirm(
  handler
) {
  const {
    confirmAction
  } =
    getRequiredElements();

  confirmAction.addEventListener(
    "click",
    handler
  );
}


export function bindPrimary(
  handler
) {
  const {
    primaryAction
  } =
    getRequiredElements();

  primaryAction.addEventListener(
    "click",
    handler
  );
}


export function bindBack(
  handler
) {
  const {
    backAction
  } =
    getRequiredElements();

  backAction.addEventListener(
    "click",
    handler
  );
}


export function bindEntryChange(
  handler
) {
  const {
    sourceCountry,
    receiverCountry,
    amount
  } =
    getRequiredElements();

  sourceCountry.addEventListener(
    "change",
    handler
  );

  receiverCountry.addEventListener(
    "change",
    handler
  );

  amount.addEventListener(
    "input",
    handler
  );
}
