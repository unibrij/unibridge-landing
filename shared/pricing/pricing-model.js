// shared/pricing/pricing-model.js

import {
  formatAmount,
  formatFxRate,
  hasValue,
  isObject,
  normalizeLower,
  normalizeString,
  normalizeUpper,
  toFiniteNumber
} from "./pricing-format.js";

import {
  resolveCanonicalFees,
  resolveFeeGroups
} from "./pricing-fees.js";

const DEFAULT_LABELS =
  Object.freeze({
    customerPayment:
      "You send",

    recipientAmount:
      "Recipient gets",

    totalFees:
      "Total fees",

    noFees:
      "No fees",

    pricingDetails:
      "Pricing details",

    settlementAmount:
      "Settlement amount",

    fxRate:
      "Exchange rate",

    providerFee:
      "Execution fee",

    unibridgeFee:
      "UniBridge fee",

    partnerFee:
      "Partner fee",

    payoutRailFee:
      "Payout rail fee",

    networkFee:
      "Network fee",

    spreadFee:
      "Exchange spread",

    otherFee:
      "Other fee",

    estimatedStatus:
      "The recipient amount is indicative and may change before execution.",

    lockedStatus:
      "The exchange rate is locked.",

    finalStatus:
      "The recipient amount is final.",

    unavailableStatus:
      "The recipient amount will be available after funding."
  });

const FEE_TYPES =
  Object.freeze({
    provider:
      "provider",

    unibridge:
      "unibridge",

    partner:
      "partner",

    payoutRail:
      "payout_rail",

    network:
      "network",

    spread:
      "spread",

    other:
      "other"
  });

const FEE_LABEL_KEYS =
  Object.freeze({
    [FEE_TYPES.provider]:
      "providerFee",

    [FEE_TYPES.unibridge]:
      "unibridgeFee",

    [FEE_TYPES.partner]:
      "partnerFee",

    [FEE_TYPES.payoutRail]:
      "payoutRailFee",

    [FEE_TYPES.network]:
      "networkFee",

    [FEE_TYPES.spread]:
      "spreadFee",

    [FEE_TYPES.other]:
      "otherFee"
  });

function resolveLabels(labels) {
  const resolved = {
    ...DEFAULT_LABELS
  };

  if (!isObject(labels)) {
    return resolved;
  }

  for (
    const key of
    Object.keys(DEFAULT_LABELS)
  ) {
    if (hasValue(labels[key])) {
      resolved[key] =
        normalizeString(
          labels[key]
        );
    }
  }

  return resolved;
}

function resolveCanonicalQuote(route) {
  const candidates = [
    route?.pricing_result?.quote,
    route?.pricing?.quote
  ];

  return (
    candidates.find(isObject) ??
    null
  );
}

function resolveCustomerPayment({
  quote,
  route,
  canonicalQuote,
  customerPaymentAmount,
  customerPaymentCurrency
}) {
  const explicitAmount =
    toFiniteNumber(
      customerPaymentAmount
    );

  if (explicitAmount !== null) {
    return {
      amount:
        explicitAmount,

      currency:
        normalizeUpper(
          customerPaymentCurrency
        )
    };
  }

  const semantics =
    normalizeLower(
      canonicalQuote
        ?.requested
        ?.semantics ??
      route?.amount_semantics
    );

  if (
    semantics !==
    "funding_amount"
  ) {
    return null;
  }

  const requestedAmount =
    toFiniteNumber(
      quote?.requested_amount
    );

  if (requestedAmount === null) {
    return null;
  }

  return {
    amount:
      requestedAmount,

    currency:
      normalizeUpper(
        customerPaymentCurrency ??
        canonicalQuote
          ?.requested
          ?.currency
      )
  };
}

function resolveRecipientStatus({
  type,
  payoutStatus,
  labels
}) {
  if (
    type === "unavailable" ||
    payoutStatus ===
      "confirmed_after_funding"
  ) {
    return {
      showAmount:
        false,

      approximate:
        false,

      note:
        labels.unavailableStatus
    };
  }

  if (
    type === "indicative" ||
    payoutStatus ===
      "estimated_before_funding"
  ) {
    return {
      showAmount:
        true,

      approximate:
        true,

      note:
        labels.estimatedStatus
    };
  }

  if (type === "locked") {
    return {
      showAmount:
        true,

      approximate:
        false,

      note:
        labels.lockedStatus
    };
  }

  if (type === "final") {
    return {
      showAmount:
        true,

      approximate:
        false,

      note:
        labels.finalStatus
    };
  }

  return {
    showAmount:
      true,

    approximate:
      false,

    note:
      null
  };
}

function createRow(
  key,
  label,
  value,
  emphasis = null
) {
  if (!hasValue(value)) {
    return null;
  }

  return {
    key,

    label:
      normalizeString(label),

    value:
      normalizeString(value),

    emphasis
  };
}

function appendRow(
  rows,
  key,
  label,
  value,
  emphasis = null
) {
  const row =
    createRow(
      key,
      label,
      value,
      emphasis
    );

  if (row) {
    rows.push(row);
  }
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

  return {
    integer:
      match[1].replace(
        /^0+(?=\d)/,
        ""
      ),

    fraction:
      match[2] ??
      ""
  };
}

function addDecimalValues(
  leftValue,
  rightValue
) {
  const left =
    normalizeDecimal(
      leftValue
    );

  const right =
    normalizeDecimal(
      rightValue
    );

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
      BigInt(
        leftDigits ||
        "0"
      ) +
      BigInt(
        rightDigits ||
        "0"
      )
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
      .slice(
        -fractionLength
      )
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
      normalizeUpper(
        fee.currency
      );

    if (
      !currency ||
      !hasValue(fee.amount)
    ) {
      continue;
    }

    const currentTotal =
      totals.get(currency) ??
      "0";

    const nextTotal =
      addDecimalValues(
        currentTotal,
        fee.amount
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
        formatAmount(
          amount,
          currency
        )
    )
    .filter(hasValue)
    .join(" + ");
}

function resolveFeeLabel(
  type,
  labels
) {
  const normalizedType =
    normalizeLower(type);

  const labelKey =
    FEE_LABEL_KEYS[
      normalizedType
    ] ??
    FEE_LABEL_KEYS.other;

  return labels[labelKey];
}

function createFeeRows({
  route,
  canonicalFees,
  labels,
  recipientCurrency,
  settlementCurrency
}) {
  const definitions = [
    {
      type:
        FEE_TYPES.provider,

      amountField:
        "executor_fee",

      currencyField:
        "executor_fee_currency",

      fallbackCurrency:
        recipientCurrency
    },

    {
      type:
        FEE_TYPES.unibridge,

      amountField:
        "unibridge_fee",

      currencyField:
        "unibridge_fee_currency",

      fallbackCurrency:
        settlementCurrency
    },

    {
      type:
        FEE_TYPES.partner,

      amountField:
        "partner_fee",

      currencyField:
        "partner_fee_currency",

      fallbackCurrency:
        null
    },

    {
      type:
        FEE_TYPES.payoutRail,

      fallbackCurrency:
        recipientCurrency
    },

    {
      type:
        FEE_TYPES.network,

      fallbackCurrency:
        settlementCurrency
    },

    {
      type:
        FEE_TYPES.spread,

      fallbackCurrency:
        settlementCurrency
    },

    {
      type:
        FEE_TYPES.other,

      fallbackCurrency:
        null
    }
  ];

  const fees = [];

  for (
    const definition of
    definitions
  ) {
    const groups =
      resolveFeeGroups({
        route,

        canonicalFees,

        type:
          definition.type,

        amountField:
          definition.amountField,

        currencyField:
          definition.currencyField,

        fallbackCurrency:
          definition.fallbackCurrency
      });

    for (const fee of groups) {
      fees.push({
        key: [
          "fee",
          definition.type,
          normalizeLower(
            fee.currency
          )
        ]
          .filter(Boolean)
          .join("_"),

        type:
          definition.type,

        label:
          resolveFeeLabel(
            definition.type,
            labels
          ),

        amount:
          fee.amount,

        currency:
          normalizeUpper(
            fee.currency
          ),

        value:
          formatAmount(
            fee.amount,
            fee.currency
          )
      });
    }
  }

  return fees;
}

export function createPricingViewModel({
  quote = null,
  route = null,

  customerPaymentAmount = null,
  customerPaymentCurrency = null,

  sourceLabel = null,
  destinationLabel = null,

  labels = null
} = {}) {
  const safeQuote =
    isObject(quote)
      ? quote
      : {};

  const safeRoute =
    isObject(route)
      ? route
      : {};

  const text =
    resolveLabels(labels);

  const canonicalQuote =
    resolveCanonicalQuote(
      safeRoute
    );

  const settlementAmount =
    canonicalQuote
      ?.settlement
      ?.amount ??
    safeRoute.funding_amount;

  const settlementCurrency =
    normalizeUpper(
      canonicalQuote
        ?.settlement
        ?.currency ??
      safeRoute
        .settlement_currency
    );

  const recipientAmount =
    canonicalQuote
      ?.recipient
      ?.amount ??
    safeRoute.payout_amount;

  const recipientCurrency =
    normalizeUpper(
      canonicalQuote
        ?.recipient
        ?.currency ??
      safeRoute
        .recipient_currency
    );

  const recipientType =
    normalizeLower(
      canonicalQuote
        ?.recipient
        ?.type ??
      safeRoute
        .recipient_amount_type
    );

  const recipientStatus =
    resolveRecipientStatus({
      type:
        recipientType,

      payoutStatus:
        normalizeLower(
          safeRoute
            .payout_amount_status
        ),

      labels:
        text
    });

  const customerPayment =
    resolveCustomerPayment({
      quote:
        safeQuote,

      route:
        safeRoute,

      canonicalQuote,

      customerPaymentAmount,
      customerPaymentCurrency
    });

  const canonicalFees =
    resolveCanonicalFees(
      safeRoute
    );

  const fees =
    createFeeRows({
      route:
        safeRoute,

      canonicalFees,

      labels:
        text,

      recipientCurrency,
      settlementCurrency
    });

  const summaryRows = [];

  if (customerPayment) {
    appendRow(
      summaryRows,
      "customer_payment",
      text.customerPayment,
      formatAmount(
        customerPayment.amount,
        customerPayment.currency
      )
    );
  }

  if (recipientStatus.showAmount) {
    appendRow(
      summaryRows,
      "recipient_amount",
      text.recipientAmount,
      formatAmount(
        recipientAmount,
        recipientCurrency,
        recipientStatus.approximate
      ),
      "recipient"
    );
  }

  const totalFees =
    summarizeFees(fees);

  appendRow(
    summaryRows,
    "total_fees",
    text.totalFees,
    hasValue(totalFees)
      ? totalFees
      : text.noFees
  );

  const detailRows = [];

  appendRow(
    detailRows,
    "fx_rate",
    text.fxRate,
    formatFxRate({
      fxRate:
        canonicalQuote
          ?.fx_rate ??
        safeRoute.fx_rate,

      settlementCurrency,
      recipientCurrency
    })
  );

  appendRow(
    detailRows,
    "settlement_amount",
    text.settlementAmount,
    formatAmount(
      settlementAmount,
      settlementCurrency
    )
  );

  for (const fee of fees) {
    appendRow(
      detailRows,
      fee.key,
      fee.label,
      fee.value
    );
  }

  return {
    summaryRows,

    details:
      detailRows.length
        ? {
            label:
              text.pricingDetails,

            rows:
              detailRows
          }
        : null,

    note:
      hasValue(
        recipientStatus.note
      )
        ? {
            value:
              recipientStatus.note
          }
        : null,

    meta: {
      sourceLabel:
        hasValue(sourceLabel)
          ? normalizeString(
              sourceLabel
            )
          : null,

      destinationLabel:
        hasValue(destinationLabel)
          ? normalizeString(
              destinationLabel
            )
          : (
              hasValue(
                safeRoute.label
              )
                ? normalizeString(
                    safeRoute.label
                  )
                : null
            )
    }
  };
}
