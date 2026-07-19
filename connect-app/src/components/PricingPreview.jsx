// connect-app/src/components/PricingPreview.jsx

function normalizeString(value) {
  return String(
    value ??
    ""
  ).trim();
}

function hasValue(value) {
  return (
    value !== undefined &&
    value !== null &&
    normalizeString(value) !== ""
  );
}

function formatNumber(value) {
  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return new Intl.NumberFormat(
    undefined,
    {
      maximumFractionDigits: 6
    }
  ).format(number);
}

function formatAmount(amount = {}) {
  if (
    !hasValue(amount?.amount) ||
    !hasValue(amount?.currency)
  ) {
    return "—";
  }

  return [
    formatNumber(amount.amount),
    normalizeString(
      amount.currency
    ).toUpperCase()
  ].join(" ");
}

function getFeeAmount(fee = {}) {
  return (
    fee.amount_decimal ??
    fee.amount
  );
}

function formatFeeAmount(fee = {}) {
  const amount =
    getFeeAmount(fee);

  if (
    !hasValue(amount) ||
    !hasValue(fee.currency)
  ) {
    return "—";
  }

  return [
    formatNumber(amount),
    normalizeString(
      fee.currency
    ).toUpperCase()
  ].join(" ");
}

function formatFeeLabel(type) {
  switch (
    normalizeString(type).toLowerCase()
  ) {
    case "provider":
      return "Execution fee";

    case "unibridge":
      return "UniBridge fee";

    case "payout_rail":
      return "Payout rail fee";

    case "network":
      return "Network fee";

    case "spread":
      return "Exchange spread";

    default:
      return "Other fee";
  }
}

function getCustomerFees(
  pricingPreview
) {
  if (
    !Array.isArray(
      pricingPreview?.fees
    )
  ) {
    return [];
  }

  return pricingPreview.fees.filter(
    fee =>
      fee &&
      fee.visibility !== "internal" &&
      hasValue(
        getFeeAmount(fee)
      ) &&
      hasValue(fee.currency)
  );
}

function normalizeDecimal(value) {
  const normalized =
    normalizeString(value);

  const match =
    normalized.match(
      /^(\d+)(?:\.(\d+))?$/
    );

  if (!match) {
    return null;
  }

  const integer =
    match[1].replace(
      /^0+(?=\d)/,
      ""
    );

  const fraction =
    match[2] ?? "";

  return {
    integer,
    fraction
  };
}

function addDecimalValues(
  leftValue,
  rightValue
) {
  const left =
    normalizeDecimal(leftValue);

  const right =
    normalizeDecimal(rightValue);

  if (!left || !right) {
    return null;
  }

  const fractionLength =
    Math.max(
      left.fraction.length,
      right.fraction.length
    );

  const leftDigits =
    [
      left.integer,
      left.fraction.padEnd(
        fractionLength,
        "0"
      )
    ].join("");

  const rightDigits =
    [
      right.integer,
      right.fraction.padEnd(
        fractionLength,
        "0"
      )
    ].join("");

  const totalDigits =
    (
      BigInt(leftDigits || "0") +
      BigInt(rightDigits || "0")
    ).toString();

  if (fractionLength === 0) {
    return totalDigits;
  }

  const paddedTotal =
    totalDigits.padStart(
      fractionLength + 1,
      "0"
    );

  const integer =
    paddedTotal.slice(
      0,
      -fractionLength
    );

  const fraction =
    paddedTotal
      .slice(-fractionLength)
      .replace(
        /0+$/,
        ""
      );

  return fraction
    ? `${integer}.${fraction}`
    : integer;
}

function summarizeFees(fees) {
  const totals =
    new Map();

  for (const fee of fees) {
    const currency =
      normalizeString(
        fee.currency
      ).toUpperCase();

    const amount =
      getFeeAmount(fee);

    if (
      !currency ||
      !hasValue(amount)
    ) {
      continue;
    }

    const currentTotal =
      totals.get(currency) ??
      "0";

    const nextTotal =
      addDecimalValues(
        currentTotal,
        amount
      );

    if (nextTotal === null) {
      continue;
    }

    totals.set(
      currency,
      nextTotal
    );
  }

  return Array
    .from(
      totals.entries()
    )
    .map(
      ([
        currency,
        amount
      ]) =>
        `${formatNumber(amount)} ${currency}`
    )
    .join(" + ");
}

export default function PricingPreview({
  pricingPreview,
  status = "idle",
  error = null
}) {
  if (status === "loading") {
    return (
      <section
        className="pricing-preview"
        aria-live="polite"
      >
        <p className="pricing-preview-status">
          Calculating pricing...
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section
        className="pricing-preview pricing-preview-error"
        role="alert"
      >
        <p className="pricing-preview-status">
          Pricing is currently unavailable.
        </p>
      </section>
    );
  }

  if (!pricingPreview) {
    return null;
  }

  const customerFees =
    getCustomerFees(
      pricingPreview
    );

  const totalFees =
    summarizeFees(
      customerFees
    );

  const hasFxRate =
    hasValue(
      pricingPreview
        ?.fx_rate
        ?.value
    ) &&
    hasValue(
      pricingPreview
        ?.fx_rate
        ?.base_currency
    ) &&
    hasValue(
      pricingPreview
        ?.fx_rate
        ?.quote_currency
    );

  const hasSettlement =
    hasValue(
      pricingPreview
        ?.settlement
        ?.amount
    ) &&
    hasValue(
      pricingPreview
        ?.settlement
        ?.currency
    );

  const hasDetails =
    hasFxRate ||
    hasSettlement ||
    customerFees.length > 0;

  return (
    <section
      className="pricing-preview"
      aria-label="Pricing preview"
    >
      <div className="pricing-preview-row">
        <span className="pricing-preview-label">
          You send
        </span>

        <strong className="pricing-preview-value">
          {formatAmount(
            pricingPreview.requested
          )}
        </strong>
      </div>

      <div className="pricing-preview-row pricing-preview-recipient">
        <span className="pricing-preview-label">
          Recipient gets
        </span>

        <strong className="pricing-preview-value">
          {formatAmount(
            pricingPreview.recipient
          )}
        </strong>
      </div>

      <div className="pricing-preview-row">
        <span className="pricing-preview-label">
          Total fees
        </span>

        <strong className="pricing-preview-value">
          {totalFees || "No fees"}
        </strong>
      </div>

      {hasDetails && (
        <details className="pricing-preview-details">
          <summary>
            Pricing details
          </summary>

          <div className="pricing-preview-details-content">
            {hasFxRate && (
              <div className="pricing-preview-detail-row">
                <span>
                  Exchange rate
                </span>

                <span>
                  1{" "}
                  {normalizeString(
                    pricingPreview
                      .fx_rate
                      .base_currency
                  ).toUpperCase()}
                  {" = "}
                  {formatNumber(
                    pricingPreview
                      .fx_rate
                      .value
                  )}{" "}
                  {normalizeString(
                    pricingPreview
                      .fx_rate
                      .quote_currency
                  ).toUpperCase()}
                </span>
              </div>
            )}

            {hasSettlement && (
              <div className="pricing-preview-detail-row">
                <span>
                  Settlement amount
                </span>

                <span>
                  {formatAmount(
                    pricingPreview
                      .settlement
                  )}
                </span>
              </div>
            )}

            {customerFees.map(
              (
                fee,
                index
              ) => (
                <div
                  className="pricing-preview-detail-row"
                  key={[
                    fee.type,
                    fee.provider,
                    fee.currency,
                    index
                  ].join("-")}
                >
                  <span>
                    {formatFeeLabel(
                      fee.type
                    )}
                  </span>

                  <span>
                    {formatFeeAmount(
                      fee
                    )}
                  </span>
                </div>
              )
            )}
          </div>
        </details>
      )}

      {pricingPreview
        ?.recipient
        ?.type ===
        "indicative" && (
        <p className="pricing-preview-note">
          The recipient amount is indicative and may change before execution.
        </p>
      )}
    </section>
  );
}
