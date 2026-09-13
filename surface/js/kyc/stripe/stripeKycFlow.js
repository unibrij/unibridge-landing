// unibridge-landing/surface/js/kyc/stripe/stripeKycFlow.js

import {
  loadStripeKycContext
} from "./stripeKycApi.js";

import {
  assertSupportedMissingFields,
  buildStripeKycPayload
} from "./stripeKycFields.js";

import {
  requestStripeKycFields,
  resetStripeKycForm
} from "./stripeKycForm.js";


export async function runStripeKycFlow({
  sdk,
  includeUsStepUp = false,
  setStatus = null
} = {}) {
  if (
    !sdk ||
    typeof sdk.submitKycInfo !==
      "function"
  ) {
    throw new Error(
      "stripe_embedded_sdk_required"
    );
  }

  const updateStatus =
    typeof setStatus ===
      "function"
      ? setStatus
      : () => {};

  updateStatus(
    "Checking Stripe identity requirements..."
  );

  let localIdNumber =
    null;

  let payload =
    null;

  try {
    let resolution =
      await loadStripeKycContext({
        includeUsStepUp
      });

    assertSupportedMissingFields(
      resolution.missing_fields
    );

    if (
      resolution
        .missing_fields
        .length
    ) {
      const collected =
        await requestStripeKycFields({
          missingFields:
            resolution
              .missing_fields,

          stripeKycInfo:
            resolution
              .stripe_kyc_info
        });

      localIdNumber =
        collected.idNumber;

      resolution =
        await loadStripeKycContext({
          supplement:
            collected.supplement,

          includeUsStepUp
        });

      assertSupportedMissingFields(
        resolution.missing_fields
      );
    }

    const unresolved =
      resolution
        .missing_fields
        .filter(
          (field) =>
            field !==
              "id_number"
        );

    if (
      unresolved.length
    ) {
      const error =
        new Error(
          "stripe_kyc_fields_still_missing"
        );

      error.fields =
        unresolved;

      throw error;
    }

    if (
      resolution
        .missing_fields
        .includes(
          "id_number"
        ) &&
      !localIdNumber
    ) {
      throw new Error(
        "stripe_kyc_id_number_required"
      );
    }

    payload =
      buildStripeKycPayload({
        stripeKycInfo:
          resolution
            .stripe_kyc_info,

        idNumber:
          localIdNumber
      });

    updateStatus(
      "Submitting identity information to Stripe..."
    );

    const result =
      await sdk.submitKycInfo(
        payload
      );

    return {
      submitted:
        true,

      step_up:
        Boolean(
          includeUsStepUp
        ),

      result:
        result ??
        null
    };
  } finally {
    if (
      payload
        ?.id_number
    ) {
      payload
        .id_number
        .value =
        "";
    }

    localIdNumber =
      null;

    resetStripeKycForm();
  }
}


export function resetStripeKycFlow() {
  resetStripeKycForm();
}
