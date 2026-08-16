// pay-by-bank/js/flow/pricing.js

import {
  clearPricing,
  createPricingViewModel,
  renderPricing
} from "/shared/pricing/index.js";

import {
  getPricingPreviewMount,
  showPricingPreview,
  clearPricingPreviewMount
} from "../ui.js";

import {
  findCountryLabel
} from "./countries.js";

import {
  normalizeString
} from "./normalization.js";


export function clearCanonicalPricing() {
  const mount =
    getPricingPreviewMount();

  clearPricing(
    mount
  );

  clearPricingPreviewMount();
}


export function renderCanonicalPricing({
  quote,
  route,
  amount,
  currency,
  sourceCountry,
  receiverCountry
}) {
  const mount =
    getPricingPreviewMount();

  clearPricing(
    mount
  );

  const model =
    createPricingViewModel({
      quote,

      route,

      customerPaymentAmount:
        amount,

      customerPaymentCurrency:
        currency,

      sourceLabel:
        findCountryLabel(
          "source",
          sourceCountry
        ),

      destinationLabel:
        normalizeString(
          route?.label
        ) ||
        findCountryLabel(
          "destination",
          receiverCountry
        )
    });

  renderPricing(
    mount,
    model
  );

  showPricingPreview();
}
