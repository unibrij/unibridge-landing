// unibridge-landing/surface/js/kyc/stripe/stripeKycApi.js

const STRIPE_KYC_CONTEXT_ENDPOINT =
  "ramp/stripe/browser/kyc-context";

function isObject(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function uniqueStrings(values) {
  return [
    ...new Set(
      (
        Array.isArray(values)
          ? values
          : []
      )
        .map(
          (value) =>
            String(value ?? "").trim()
        )
        .filter(Boolean)
    )
  ];
}

function getApiPost() {
  const apiPost =
    window.UnibridgeApi?.apiPost;

  if (
    typeof apiPost !== "function"
  ) {
    throw new Error(
      "surface_api_unavailable"
    );
  }

  return apiPost;
}

export async function loadStripeKycContext({
  supplement = {},
  includeUsStepUp = false
} = {}) {
  const apiPost =
    getApiPost();

  const response =
    await apiPost(
      STRIPE_KYC_CONTEXT_ENDPOINT,
      {
        include_us_step_up:
          Boolean(includeUsStepUp),

        supplement:
          isObject(supplement)
            ? supplement
            : {}
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
