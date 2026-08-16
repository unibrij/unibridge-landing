// pay-by-bank/js/ui.js

const elements = {
  sourceCountry:
    document.getElementById(
      "sourceCountry"
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

  statusBox:
    document.getElementById(
      "statusBox"
    ),

  continueAction:
    document.getElementById(
      "continueAction"
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
    !Array.isArray(countries)
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


export function initializeUI({
  countries = [],
  currency = "EUR"
} = {}) {
  const ui =
    getRequiredElements();

  populateSourceCountries(
    countries
  );

  setCurrency(
    currency
  );

  showEntry();

  clearStatus();

  hideRouteSummary();

  setContinueBusy(
    false
  );

  setPrimaryBusy(
    false
  );

  return ui;
}


export function populateSourceCountries(
  countries = []
) {
  const {
    sourceCountry
  } =
    getRequiredElements();

  const options =
    normalizeCountryOptions(
      countries
    );

  sourceCountry.replaceChildren();

  const placeholder =
    document.createElement(
      "option"
    );

  placeholder.value =
    "";

  placeholder.textContent =
    "Select country";

  placeholder.disabled =
    true;

  placeholder.selected =
    true;

  sourceCountry.appendChild(
    placeholder
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

    sourceCountry.appendChild(
      option
    );
  }
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

    amount:
      amount.value
  };
}


export function validateEntryForm() {
  const {
    sourceCountry,
    amount
  } =
    getRequiredElements();

  clearFieldError(
    sourceCountry
  );

  clearFieldError(
    amount
  );

  let valid =
    true;

  const country =
    String(
      sourceCountry.value ||
      ""
    ).trim();

  if (!country) {
    showFieldError(
      sourceCountry,
      "Choose your country."
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
  amount,
  currency = "EUR"
} = {}) {
  const {
    routeSummary
  } =
    getRequiredElements();

  const normalizedCurrency =
    String(
      currency || "EUR"
    )
      .trim()
      .toUpperCase();

  const normalizedCountry =
    String(
      sourceCountry || ""
    )
      .trim()
      .toUpperCase();

  const normalizedAmount =
    Number(
      amount
    );

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
        normalizedCountry ||
        "—"
    },
    {
      label:
        "Amount",

      value:
        Number.isFinite(
          normalizedAmount
        )
          ? `${normalizedAmount.toFixed(
              2
            )} ${normalizedCurrency}`
          : "—"
    },
    {
      label:
        "Method",

      value:
        "Bank transfer"
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
    "Preparing…",
    "Continue"
  );
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
