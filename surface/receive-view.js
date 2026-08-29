// unibridge-landing/surface/receive-view.js

function normalizeString(value) {
  return String(value ?? "").trim();
}

function formatRail(value) {
  const rail = normalizeString(value);

  if (!rail) {
    return "";
  }

  return rail
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

function formatCountry(value) {
  const country =
    normalizeString(value)
      .toUpperCase();

  if (!country) {
    return "";
  }

  try {
    return new Intl.DisplayNames(
      ["en"],
      {
        type: "region"
      }
    ).of(country) || country;
  }
  catch {
    return country;
  }
}

function buildRecipientText(
  recipient = {}
) {
  const label =
    normalizeString(
      recipient.label
    );

  const maskedIdentifier =
    normalizeString(
      recipient.masked_identifier
    );

  return [
    label &&
    label.toLowerCase() !==
      "recipient"
      ? label
      : "",

    maskedIdentifier
  ]
    .filter(Boolean)
    .join(" · ") ||
    label ||
    "Recipient";
}

function setHidden(
  element,
  hidden
) {
  if (!element) {
    return;
  }

  const shouldHide =
    Boolean(hidden);

  element.hidden =
    shouldHide;

  element.classList.toggle(
    "hidden",
    shouldHide
  );

  element.style.display =
    shouldHide
      ? "none"
      : "";
}

function createLockedField({
  label,
  value
} = {}) {
  const field =
    document.createElement(
      "label"
    );

  field.className =
    "field";

  const fieldLabel =
    document.createElement(
      "span"
    );

  fieldLabel.textContent =
    normalizeString(label);

  const input =
    document.createElement(
      "input"
    );

  input.type =
    "text";

  input.value =
    normalizeString(value) ||
    "—";

  input.readOnly =
    true;

  input.disabled =
    true;

  input.setAttribute(
    "aria-label",
    normalizeString(label)
  );

  field.append(
    fieldLabel,
    input
  );

  return field;
}

export function createSurfaceReceiveView({
  receiveBound = false,
  receiveContext = null,
  getValue
} = {}) {
  function renderSummary() {
    const summary =
      getValue?.(
        "receiveSummary"
      );

    const recipientContainer =
      getValue?.(
        "receiveSummaryRecipient"
      );

    const destinationContainer =
      getValue?.(
        "receiveSummaryDestination"
      );

    if (
      !summary ||
      !recipientContainer ||
      !destinationContainer
    ) {
      return;
    }

    const recipient =
      receiveContext
        ?.recipient ||
      {};

    const recipientText =
      buildRecipientText(
        recipient
      );

    const country =
      formatCountry(
        receiveContext
          ?.destination_country
      );

    const rail =
      formatRail(
        receiveContext
          ?.payout_rail
      );

    recipientContainer
      .replaceChildren(
        createLockedField({
          label:
            "Recipient",

          value:
            recipientText
        })
      );

    destinationContainer
      .replaceChildren(
        createLockedField({
          label:
            "Receives in",

          value:
            country
        }),

        createLockedField({
          label:
            "Receiving method",

          value:
            rail
        })
      );

    destinationContainer
      .classList
      .add(
        "form-grid"
      );

    setHidden(
      summary,
      false
    );
  }

  function apply() {
    if (!receiveBound) {
      return;
    }

    const countryField =
      getValue?.(
        "country"
      );

    const countrySection =
      getValue?.(
        "destinationCountrySection"
      );

    const destinationHeader =
      getValue?.(
        "destinationDetailsHeader"
      );

    const destinationFields =
      getValue?.(
        "destinationFields"
      );

    const coinsPhBox =
      getValue?.(
        "coinsPhBox"
      );

    if (countryField) {
      countryField.disabled =
        true;
    }

    setHidden(
      countrySection,
      true
    );

    setHidden(
      destinationHeader,
      true
    );

    setHidden(
      destinationFields,
      true
    );

    setHidden(
      coinsPhBox,
      true
    );

    renderSummary();
  }

  return {
    apply
  };
}
