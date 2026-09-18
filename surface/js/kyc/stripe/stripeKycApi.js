// unibridge-landing/surface/js/kyc/stripe/stripeKycApi.js

import {
  stripeBrowserPostJson
} from "../../ramp/stripeEmbedded/stripeBrowserApi.js";


const STRIPE_KYC_CONTEXT_ENDPOINT =
  "/v2/ramp/stripe/browser/kyc-context";


function isObject(
  value
) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}


function uniqueStrings(
  values
) {
  return [
    ...new Set(
      (
        Array.isArray(values)
          ? values
          : []
      )
        .map(
          (
            value
          ) =>
            String(
              value ?? ""
            ).trim()
        )
        .filter(
          Boolean
        )
    )
  ];
}


export async function loadStripeKycContext({
  supplement = {},
  includeUsStepUp = false
} = {}) {
  const response =
    await stripeBrowserPostJson(
      STRIPE_KYC_CONTEXT_ENDPOINT,
      {
        include_us_step_up:
          Boolean(
            includeUsStepUp
          ),

        supplement:
          isObject(
            supplement
          )
            ? supplement
            : {}
      },
      {
        errorPrefix:
          "stripe_kyc_context"
      }
    );

  if (
    !response ||
    typeof response !== "object"
  ) {
    throw new Error(
      "stripe_kyc_context_invalid_response"
    );
  }

  return {
    ready:
      response.ready === true,

    required_fields:
      uniqueStrings(
        response.required_fields
      ),

    missing_fields:
      uniqueStrings(
        response.missing_fields
      ),

    stripe_kyc_info:
      isObject(
        response.stripe_kyc_info
      )
        ? response.stripe_kyc_info
        : {}
  };
}
