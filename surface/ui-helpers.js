// unibridge-landing/surface/ui-helpers.js

export function formatNumber(
  value,
  maximumFractionDigits = 2
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return "—";
  }

  return number.toLocaleString(
    "en-US",
    {
      maximumFractionDigits
    }
  );
}

function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}

function normalizeLower(
  value
) {
  return normalizeString(
    value
  ).toLowerCase();
}

function normalizeUpper(
  value
) {
  return normalizeString(
    value
  ).toUpperCase();
}

function hasValue(
  value
) {
  return (
    value !== undefined &&
    value !== null &&
    normalizeString(value) !== ""
  );
}

function formatAmount(
  amount,
  currency,
  approximate = false
) {
  if (!hasValue(amount)) {
    return "";
  }

  const formattedAmount =
    formatNumber(
      amount
    );

  if (
    formattedAmount ===
    "—"
  ) {
    return "";
  }

  return [
    approximate
      ? "≈"
      : "",

    formattedAmount,

    normalizeUpper(
      currency
    )
  ]
    .filter(Boolean)
    .join(" ");
}

export function setTextIfPresent(
  id,
  value
) {
  const element =
    document.getElementById(
      id
    );

  if (element) {
    element.textContent =
      normalizeString(
        value
      );
  }
}

export function setDisplayIfPresent(
  id,
  displayValue
) {
  const element =
    document.getElementById(
      id
    );

  if (!element) {
    return;
  }

  const hidden =
    displayValue ===
      "none";

  element.classList.toggle(
    "hidden",
    hidden
  );

  element.style.display =
    hidden
      ? "none"
      : "";
}

function renderRow(
  rowId,
  valueId,
  value
) {
  if (!hasValue(value)) {
    setTextIfPresent(
      valueId,
      ""
    );

    setDisplayIfPresent(
      rowId,
      "none"
    );

    return;
  }

  setTextIfPresent(
    valueId,
    value
  );

  setDisplayIfPresent(
    rowId,
    ""
  );
}

function formatFxRate({
  fxRate,
  settlementCurrency,
  recipientCurrency
}) {
  const isObject =
    Boolean(
      fxRate &&
      typeof fxRate ===
        "object" &&
      !Array.isArray(
        fxRate
      )
    );

  const value =
    isObject
      ? (
          fxRate.value ??
          fxRate.rate
        )
      : fxRate;

  if (!hasValue(value)) {
    return "";
  }

  const formattedRate =
    formatNumber(
      value,
      6
    );

  if (
    formattedRate ===
      "—"
  ) {
    return "";
  }

  const baseCurrency =
    normalizeUpper(
      isObject
        ? (
            fxRate.base_currency ??
            fxRate.baseCurrency ??
            settlementCurrency
          )
        : settlementCurrency
    );

  const quoteCurrency =
    normalizeUpper(
      isObject
        ? (
            fxRate.quote_currency ??
            fxRate.quoteCurrency ??
            recipientCurrency
          )
        : recipientCurrency
    );

  if (
    baseCurrency &&
    quoteCurrency
  ) {
    return (
      `1 ${baseCurrency} ≈ ` +
      `${formattedRate} ${quoteCurrency}`
    );
  }

  return formattedRate;
}

function resolvePricingStatus({
  recipientAmountType,
  payoutAmountStatus
}) {
  const type =
    normalizeLower(
      recipientAmountType
    );

  const status =
    normalizeLower(
      payoutAmountStatus
    );

  if (
    type ===
      "indicative" ||
    status ===
      "estimated_before_funding"
  ) {
    return {
      text:
        "Estimated — confirmed after funding",

      approximate:
        true
    };
  }

  if (
    type ===
      "locked"
  ) {
    return {
      text:
        "Rate locked",

      approximate:
        false
    };
  }

  if (
    type ===
      "final"
  ) {
    return {
      text:
        "Final amount",

      approximate:
        false
    };
  }

  if (
    type ===
      "unavailable" ||
    status ===
      "confirmed_after_funding"
  ) {
    return {
      text:
        "Available after funding",

      approximate:
        false
    };
  }

  return {
    text:
      "",

    approximate:
      false
  };
}

export function renderExecutionQuote({
  requestedAmount = null,
  customerPaymentCurrency = "USD",

  fundingAmount = null,
  settlementCurrency = null,

  payoutAmount = null,
  recipientCurrency = null,
  recipientAmountType = null,
  payoutAmountStatus = null,

  executorFee = null,
  unibridgeFee = null,
  fxRate = null,

  countryLabel = null,
  setStatus = null
} = {}) {
  const pricingStatus =
    resolvePricingStatus({
      recipientAmountType,
      payoutAmountStatus
    });

  const recipientAmountText =
    hasValue(
      payoutAmount
    )
      ? formatAmount(
          payoutAmount,
          recipientCurrency,
          pricingStatus.approximate
        )
      : pricingStatus.text;

  renderRow(
    "recipientAmountRow",
    "sumRecipientAmount",
    recipientAmountText
  );

  renderRow(
    "customerPaymentRow",
    "sumCustomerPayment",
    formatAmount(
      requestedAmount,
      customerPaymentCurrency
    )
  );

  renderRow(
    "settlementAmountRow",
    "sumSettlementAmount",
    formatAmount(
      fundingAmount,
      settlementCurrency
    )
  );

  renderRow(
    "fxRateRow",
    "sumFxRate",
    formatFxRate({
      fxRate,
      settlementCurrency,
      recipientCurrency
    })
  );

  renderRow(
    "executorFeeRow",
    "sumExecutorFee",
    hasValue(
      executorFee
    )
      ? formatAmount(
          executorFee,
          recipientCurrency
        )
      : ""
  );

  renderRow(
    "unibridgeFeeRow",
    "sumUnibridgeFee",
    hasValue(
      unibridgeFee
    )
      ? formatAmount(
          unibridgeFee,
          recipientCurrency
        )
      : ""
  );

  renderRow(
    "recipientAmountStatusRow",
    "sumRecipientAmountStatus",
    hasValue(
      payoutAmount
    )
      ? pricingStatus.text
      : ""
  );

  renderRow(
    "destinationSummaryRow",
    "sumCountry",
    countryLabel
  );

  const newSummaryExists =
    Boolean(
      document.getElementById(
        "sumRecipientAmount"
      )
    );

  if (
    !newSummaryExists &&
    typeof setStatus ===
      "function"
  ) {
    const parts =
      [
        recipientAmountText
          ? (
              `Recipient receives: ` +
              recipientAmountText
            )
          : null,

        hasValue(
          requestedAmount
        )
          ? (
              `Card payment: ` +
              formatAmount(
                requestedAmount,
                customerPaymentCurrency
              )
            )
          : null,

        countryLabel
          ? (
              `Destination: ` +
              countryLabel
            )
          : null
      ]
        .filter(Boolean);

    setStatus(
      parts.join(
        "\n"
      )
    );
  }
}
