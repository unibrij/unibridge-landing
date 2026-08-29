// unibridge-landing/surface/receive-view.js

function normalizeString(value) {
  return String(
    value ??
    ""
  ).trim();
}

function formatRail(value) {
  const rail =
    normalizeString(
      value
    );

  if (!rail) {
    return "";
  }

  return rail
    .replace(
      /[_-]+/g,
      " "
    )
    .replace(
      /\b\w/g,
      char =>
        char.toUpperCase()
    );
}

function formatDestination({
  country,
  rail
} = {}) {
  return [
    normalizeString(
      country
    ).toUpperCase(),

    formatRail(
      rail
    )
  ]
    .filter(
      Boolean
    )
    .join(
      " · "
    );
}

export function createSurfaceReceiveView({
  receiveBound = false,
  receiveContext = null,
  getValue
} = {}) {
  function setHidden(
    element,
    hidden
  ) {
    if (!element) {
      return;
    }

    element.hidden =
      Boolean(
        hidden
      );
  }

  function setText(
    element,
    value
  ) {
    if (!element) {
      return;
    }

    element.textContent =
      normalizeString(
        value
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

    const destinationFields =
      getValue?.(
        "destinationFields"
      );

    const coinsPhSection =
      getValue?.(
        "coinsPhDestinationSection"
      );

    const summary =
      getValue?.(
        "receiveSummary"
      );

    const summaryRecipient =
      getValue?.(
        "receiveSummaryRecipient"
      );

    const summaryDestination =
      getValue?.(
        "receiveSummaryDestination"
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
      destinationFields,
      true
    );

    setHidden(
      coinsPhSection,
      true
    );

    const recipient =
      receiveContext
        ?.recipient ||
      {};

    const recipientText =
      [
        normalizeString(
          recipient.label
        ),

        normalizeString(
          recipient.masked_identifier
        )
      ]
        .filter(
          Boolean
        )
        .join(
          " · "
        ) ||
      "Recipient";

    const destinationText =
      formatDestination({
        country:
          receiveContext
            ?.destination_country,

        rail:
          receiveContext
            ?.payout_rail
      });

    setText(
      summaryRecipient,
      recipientText
    );

    setText(
      summaryDestination,
      destinationText
    );

    setHidden(
      summary,
      false
    );
  }

  return {
    apply
  };
}
