// unibrij/unibridge-landing/surface/js/ramp/stripeEmbedded/stripePaymentMethod.js

function requireString(
  value,
  errorCode
) {
  const normalized =
    String(
      value ?? ""
    ).trim();

  if (!normalized) {
    throw new Error(
      errorCode
    );
  }

  return normalized;
}


/*
--------------------------------------------------
Start ACH payment-method collection

The Stripe SDK returns a payment element while the
actual payment token arrives later through the callback.

Return both:

  element
  completion

The caller owns DOM mounting.
--------------------------------------------------
*/

export async function startStripeAchPaymentMethodCollection({
  sdk
} = {}) {
  if (
    !sdk ||
    typeof sdk.collectPaymentMethod !==
      "function"
  ) {
    throw new Error(
      "stripe_collect_payment_method_not_available"
    );
  }

  let resolveCompletion;
  let rejectCompletion;

  const completion =
    new Promise(
      (
        resolve,
        reject
      ) => {
        resolveCompletion =
          resolve;

        rejectCompletion =
          reject;
      }
    );

  const paymentElement =
    await sdk.collectPaymentMethod(
      {
        payment_method_types: [
          "us_bank_account"
        ],

        wallets: {
          applePay:
            "never",

          googlePay:
            "never"
        }
      },

      (
        result
      ) => {
        const token =
          result?.cryptoPaymentToken ??
          result?.crypto_payment_token ??
          null;

        if (token) {
          try {
            resolveCompletion({
              cryptoPaymentToken:
                requireString(
                  token,
                  "missing_crypto_payment_token"
                )
            });
          } catch (
            error
          ) {
            rejectCompletion(
              error
            );
          }

          return;
        }

        if (
          result?.result ===
            "abandoned"
        ) {
          rejectCompletion(
            new Error(
              "stripe_ach_collection_abandoned"
            )
          );

          return;
        }

        if (
          result?.error
        ) {
          const error =
            new Error(
              result?.error?.message ||
              "stripe_ach_collection_failed"
            );

          error.payload =
            result?.error;

          rejectCompletion(
            error
          );

          return;
        }

        const error =
          new Error(
            "stripe_ach_collection_failed"
          );

        error.payload =
          result ??
          null;

        rejectCompletion(
          error
        );
      }
    );

  if (
    !paymentElement
  ) {
    throw new Error(
      "stripe_payment_method_element_missing"
    );
  }

  return {
    element:
      paymentElement,

    completion
  };
}
