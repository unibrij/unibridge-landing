// unibrij/unibridge-landing/surface/js/ramp/stripeEmbedded/stripeHeadless.js

import {
  stripeBrowserPostJson
} from "./stripeBrowserApi.js";


const STRIPE_HEADLESS_SESSION_URL =
  "/v2/ramp/stripe/browser/headless-session";

const STRIPE_HEADLESS_CHECKOUT_URL =
  "/v2/ramp/stripe/browser/headless-checkout";


function normalizeString(
  value
) {
  return String(
    value ?? ""
  ).trim();
}


function requireString(
  value,
  errorCode
) {
  const normalized =
    normalizeString(
      value
    );

  if (!normalized) {
    throw new Error(
      errorCode
    );
  }

  return normalized;
}


function normalizeOptionalString(
  value
) {
  return (
    normalizeString(
      value
    ) ||
    null
  );
}


/*
--------------------------------------------------
Create response normalization

Important:

The create-stage client_secret may be present in the
backend response, but this module intentionally does
not carry it forward into the checkout flow.

performCheckout() must use only the checkout-stage
client_secret returned by /headless-checkout.
--------------------------------------------------
*/

function normalizeHeadlessSessionPayload({
  payload,
  settlementId
}) {
  if (
    !payload ||
    typeof payload !==
      "object"
  ) {
    throw new Error(
      "stripe_headless_session_invalid_response"
    );
  }

  const responseSettlementId =
    requireString(
      payload?.settlement_id,
      "stripe_headless_session_missing_settlement_id"
    );

  if (
    responseSettlementId !==
      settlementId
  ) {
    throw new Error(
      "stripe_headless_session_settlement_mismatch"
    );
  }

  const session =
    payload?.session;

  if (
    !session ||
    typeof session !==
      "object"
  ) {
    throw new Error(
      "stripe_headless_session_missing_session"
    );
  }

  const sessionId =
    requireString(
      session?.session_id,
      "stripe_headless_session_missing_session_id"
    );

  return {
    settlementId:
      responseSettlementId,

    sessionId,

    status:
      normalizeOptionalString(
        session?.status
      ),

    livemode:
      typeof session?.livemode ===
        "boolean"
        ? session.livemode
        : null,

    sourceAmount:
      session?.source_amount ??
      null,

    sourceCurrency:
      normalizeOptionalString(
        session?.source_currency
      )
        ?.toLowerCase() ??
      null,

    destinationAmount:
      session?.destination_amount ??
      null,

    destinationCurrency:
      normalizeOptionalString(
        session?.destination_currency
      )
        ?.toLowerCase() ??
      null,

    destinationNetwork:
      normalizeOptionalString(
        session?.destination_network
      )
        ?.toLowerCase() ??
      null,

    quoteExpiration:
      session?.quote_expiration ??
      null
  };
}


/*
--------------------------------------------------
Checkout response normalization

The checkout-stage client_secret is short-lived
browser material used only by Stripe SDK.

Never persist or log it.
--------------------------------------------------
*/

function normalizeHeadlessCheckoutPayload({
  payload,
  settlementId,
  sessionId
}) {
  if (
    !payload ||
    typeof payload !==
      "object"
  ) {
    throw new Error(
      "stripe_headless_checkout_invalid_response"
    );
  }

  const responseSettlementId =
    requireString(
      payload?.settlement_id,
      "stripe_headless_checkout_missing_settlement_id"
    );

  if (
    responseSettlementId !==
      settlementId
  ) {
    throw new Error(
      "stripe_headless_checkout_settlement_mismatch"
    );
  }

  const responseSessionId =
    requireString(
      payload?.session_id,
      "stripe_headless_checkout_missing_session_id"
    );

  if (
    responseSessionId !==
      sessionId
  ) {
    throw new Error(
      "stripe_headless_checkout_session_mismatch"
    );
  }

  return {
    clientSecret:
      requireString(
        payload?.client_secret,
        "stripe_headless_checkout_missing_client_secret"
      )
  };
}


/*
--------------------------------------------------
Create Headless Session

The backend remains authoritative for:

- amount
- source currency
- destination asset
- destination network
- destination wallet
- ACH settlement speed

The browser supplies only the correlation IDs and
Stripe payment token needed to start the operation.
--------------------------------------------------
*/

export async function createStripeHeadlessSession({
  settlementId,
  authIntentId,
  cryptoCustomerId,
  cryptoPaymentToken
}) {
  const normalizedSettlementId =
    requireString(
      settlementId,
      "missing_settlement_id"
    );

  const normalizedAuthIntentId =
    requireString(
      authIntentId,
      "missing_auth_intent_id"
    );

  const normalizedCryptoCustomerId =
    requireString(
      cryptoCustomerId,
      "missing_crypto_customer_id"
    );

  const normalizedPaymentToken =
    requireString(
      cryptoPaymentToken,
      "missing_crypto_payment_token"
    );

  if (
    typeof stripeBrowserPostJson !==
      "function"
  ) {
    throw new Error(
      "stripe_browser_api_runtime_missing"
    );
  }

  const payload =
    await stripeBrowserPostJson(
      STRIPE_HEADLESS_SESSION_URL,
      {
        settlementId:
          normalizedSettlementId,

        authIntentId:
          normalizedAuthIntentId,

        cryptoCustomerId:
          normalizedCryptoCustomerId,

        paymentToken:
          normalizedPaymentToken
      },
      {
        errorPrefix:
          "stripe_headless_session"
      }
    );

  return normalizeHeadlessSessionPayload({
    payload,

    settlementId:
      normalizedSettlementId
  });
}


/*
--------------------------------------------------
Perform Headless Checkout

Stripe SDK controls when the checkout callback runs.

When invoked:

1. verify the requested Stripe session ID;
2. call UniBridge /headless-checkout;
3. backend verifies the authoritative binding;
4. backend calls Stripe /checkout;
5. return only the checkout-stage client_secret.

The create-stage client_secret is never reused here.
--------------------------------------------------
*/

export async function performStripeHeadlessCheckout({
  sdk,
  settlementId,
  authIntentId,
  headlessSession,
  assertActive = null
}) {
  if (
    !sdk ||
    typeof sdk.performCheckout !==
      "function"
  ) {
    throw new Error(
      "stripe_perform_checkout_not_available"
    );
  }

  const normalizedSettlementId =
    requireString(
      settlementId,
      "missing_settlement_id"
    );

  const normalizedAuthIntentId =
    requireString(
      authIntentId,
      "missing_auth_intent_id"
    );

  const sessionId =
    requireString(
      headlessSession?.sessionId,
      "stripe_checkout_missing_session_id"
    );


  const assertFlowActive =
    () => {
      if (
        typeof assertActive ===
          "function"
      ) {
        assertActive();
      }
    };


  assertFlowActive();


  const result =
    await sdk.performCheckout(
      sessionId,

      async (
        requestedSessionId
      ) => {
        assertFlowActive();

        const normalizedRequestedSessionId =
          requireString(
            requestedSessionId,
            "stripe_checkout_missing_requested_session_id"
          );

        if (
          normalizedRequestedSessionId !==
            sessionId
        ) {
          throw new Error(
            "stripe_checkout_session_mismatch"
          );
        }


        /*
        --------------------------------------------------
        Important lifecycle boundary

        Do not return the client_secret from session
        creation.

        Stripe requires the client_secret produced by
        the server-side /checkout stage.
        --------------------------------------------------
        */

        const payload =
          await stripeBrowserPostJson(
            STRIPE_HEADLESS_CHECKOUT_URL,
            {
              settlementId:
                normalizedSettlementId,

              authIntentId:
                normalizedAuthIntentId,

              sessionId:
                normalizedRequestedSessionId
            },
            {
              errorPrefix:
                "stripe_headless_checkout"
            }
          );

        assertFlowActive();

        const checkout =
          normalizeHeadlessCheckoutPayload({
            payload,

            settlementId:
              normalizedSettlementId,

            sessionId:
              normalizedRequestedSessionId
          });

        return checkout.clientSecret;
      }
    );


  assertFlowActive();


  if (
    !result ||
    result.successful !==
      true
  ) {
    const error =
      new Error(
        "stripe_checkout_not_successful"
      );

    error.checkoutResult =
      result ??
      null;

    throw error;
  }


  return {
    successful:
      true
  };
}
