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
    title:
      "Quote ready",

    subtitle:
      "Review the estimated transaction details.",

    recipientAmount:
      "Recipient receives",

    customerPayment:
      "You pay",

    settlementAmount:
      "Settlement amount",

    fxRate:
      "Exchange rate",

    providerFee:
      "Provider fee",

    unibridgeFee:
      "UniBridge fee",

    partnerFee:
      "Partner fee",

    estimatedStatus:
      "Estimated — confirmed after funding",

    lockedStatus:
      "Rate locked",

    finalStatus:
      "Final amount",

    unavailableStatus:
      "Available after funding"
  });

const FEE_TYPES =
  Object.freeze({
    provider:
      "provider",

    unibridge:
      "unibridge",

    partner:
      "partner"
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
        normalizeString(labels[key]);
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
    semantics !== "funding_amount"
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
      showAmount: false,
      approximate: false,
      value:
        labels.unavailableStatus
    };
  }

  if (
    type === "indicative" ||
    payoutStatus ===
      "estimated_before_funding"
  ) {
    return {
      showAmount: true,
      approximate: true,
      value:
        labels.estimatedStatus
    };
  }

  if (type === "locked") {
    return {
      showAmount: true,
      approximate: false,
      value:
        labels.lockedStatus
    };
  }

  if (type === "final") {
    return {
      showAmount: true,
      approximate: false,
      value:
        labels.finalStatus
    };
  }

  return {
    showAmount: true,
    approximate: false,
    value: ""
  };
}

function createRow(
  key,
  label,
  value,
  primary = false
) {
  if (!hasValue(value)) {
    return null;
  }

  return {
    key,
    label,
    value:
      normalizeString(value),
    primary
  };
}

function appendRow(
  rows,
  key,
  label,
  value,
  primary = false
) {
  const row =
    createRow(
      key,
      label,
      value,
      primary
    );

  if (row) {
    rows.push(row);
  }
}

function appendFeeRows({
  rows,
  fees,
  key,
  label
}) {
  for (const fee of fees) {
    appendRow(
      rows,
      `${key}_${fee.currency.toLowerCase()}`,
      label,
      formatAmount(
        fee.amount,
        fee.currency
      )
    );
  }
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
    resolveCanonicalQuote(safeRoute);

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
      safeRoute.settlement_currency
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
      safeRoute.recipient_currency
    );

  const recipientType =
    normalizeLower(
      canonicalQuote
        ?.recipient
        ?.type ??
      safeRoute.recipient_amount_type
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

  const rows = [];

  if (recipientStatus.showAmount) {
    appendRow(
      rows,
      "recipient_amount",
      text.recipientAmount,
      formatAmount(
        recipientAmount,
        recipientCurrency,
        recipientStatus.approximate
      ),
      true
    );
  }

  if (customerPayment) {
    appendRow(
      rows,
      "customer_payment",
      text.customerPayment,
      formatAmount(
        customerPayment.amount,
        customerPayment.currency
      )
    );
  }

  appendRow(
    rows,
    "settlement_amount",
    text.settlementAmount,
    formatAmount(
      settlementAmount,
      settlementCurrency
    )
  );

  appendRow(
    rows,
    "fx_rate",
    text.fxRate,
    formatFxRate({
      fxRate:
        canonicalQuote?.fx_rate ??
        safeRoute.fx_rate,

      settlementCurrency,
      recipientCurrency
    })
  );

  const canonicalFees =
    resolveCanonicalFees(safeRoute);

  appendFeeRows({
    rows,

    fees:
      resolveFeeGroups({
        route:
          safeRoute,

        canonicalFees,

        type:
          FEE_TYPES.provider,

        amountField:
          "executor_fee",

        currencyField:
          "executor_fee_currency",

        fallbackCurrency:
          recipientCurrency
      }),

    key:
      "provider_fee",

    label:
      text.providerFee
  });

  appendFeeRows({
    rows,

    fees:
      resolveFeeGroups({
        route:
          safeRoute,

        canonicalFees,

        type:
          FEE_TYPES.unibridge,

        amountField:
          "unibridge_fee",

        currencyField:
          "unibridge_fee_currency",

        fallbackCurrency:
          settlementCurrency
      }),

    key:
      "unibridge_fee",

    label:
      text.unibridgeFee
  });

  appendFeeRows({
    rows,

    fees:
      resolveFeeGroups({
        route:
          safeRoute,

        canonicalFees,

        type:
          FEE_TYPES.partner,

        amountField:
          "partner_fee",

        currencyField:
          "partner_fee_currency"
      }),

    key:
      "partner_fee",

    label:
      text.partnerFee
  });

  return {
    header: {
      title:
        text.title,

      subtitle:
        text.subtitle
    },

    rows,

    status:
      hasValue(
        recipientStatus.value
      )
        ? {
            value:
              recipientStatus.value
          }
        : null,

    meta: {
      sourceLabel:
        hasValue(sourceLabel)
          ? normalizeString(sourceLabel)
          : null,

      destinationLabel:
        hasValue(destinationLabel)
          ? normalizeString(
              destinationLabel
            )
          : (
              hasValue(safeRoute.label)
                ? normalizeString(
                    safeRoute.label
                  )
                : null
            )
    }
  };
}
