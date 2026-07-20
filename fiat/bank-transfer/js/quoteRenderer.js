// fiat/bank-transfer/js/quoteRenderer.js

import {
  clearPricing,
  createPricingViewModel,
  renderPricing
} from "../../../shared/pricing/index.js";

function normalizeString(value) {
  return String(
    value ??
    ""
  ).trim();
}

function buildSourceLabel(form = {}) {
  return [
    normalizeString(
      form.source_country
    ),

    normalizeString(
      form.source_rail
    )
  ]
    .filter(Boolean)
    .join(" / ");
}

function buildDestinationLabel(
  form = {},
  selectedRoute = {}
) {
  return (
    normalizeString(
      selectedRoute.label
    ) ||
    normalizeString(
      form.receiver_country
    )
  );
}

export function renderQuote(
  container,
  {
    form,
    quote,
    selectedRoute
  } = {}
) {
  if (!container) {
    return;
  }

  if (
    !form ||
    !quote ||
    !selectedRoute
  ) {
    clearPricing(
      container
    );

    container.classList.add(
      "hidden"
    );

    return;
  }

  const viewModel =
    createPricingViewModel({
      quote,

      route:
        selectedRoute,

      customerPaymentAmount:
        form.amount,

      customerPaymentCurrency:
        form.source_currency,

      sourceLabel:
        buildSourceLabel(
          form
        ),

      destinationLabel:
        buildDestinationLabel(
          form,
          selectedRoute
        )
    });

  renderPricing(
    container,
    viewModel
  );

  container.classList.remove(
    "hidden"
  );
}
