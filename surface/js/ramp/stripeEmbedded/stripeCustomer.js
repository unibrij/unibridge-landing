// unibridge-landing/surface/js/ramp/stripeEmbedded/stripeCustomer.js

import {
  stripeBrowserPostJson
} from "./stripeBrowserApi.js";


const CREATE_LINK_AUTH_INTENT_URL =
  "/v2/ramp/stripe/browser/link-auth-intent";

const CUSTOMER_CONTEXT_URL =
  "/v2/ramp/stripe/browser/customer-context";


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


/*
--------------------------------------------------
Create LinkAuthIntent

Email comes from the authenticated Surface flow.

The browser request is authenticated with the
current Clerk session through stripeBrowserApi.

OAuth tokens never enter the browser.
--------------------------------------------------
*/

export async function createStripeLinkAuthIntent({
  email
} = {}) {
  const normalizedEmail =
    requireString(
      email,
      "missing_email"
    )
      .toLowerCase();

  const payload =
    await stripeBrowserPostJson(
      CREATE_LINK_AUTH_INTENT_URL,
      {
        email:
          normalizedEmail
      },
      {
        errorPrefix:
          "stripe_link_auth_intent"
      }
    );

  return {
    authIntentId:
      requireString(
        payload?.authIntentId ??
        payload?.id,
        "missing_auth_intent_id"
      ),

    expiresAt:
      payload?.expiresAt ??
      null
  };
}


/*
--------------------------------------------------
Start Link authentication

The Stripe SDK returns an authentication element
while the actual authentication result arrives later
through the callback.

Return both:

  element
  completion

The caller owns DOM mounting.
--------------------------------------------------
*/

export async function startStripeCustomerAuthentication({
  sdk,
  authIntentId
} = {}) {
  if (
    !sdk ||
    typeof sdk.authenticate !==
      "function"
  ) {
    throw new Error(
      "stripe_authenticate_not_available"
    );
  }

  const normalizedAuthIntentId =
    requireString(
      authIntentId,
      "missing_auth_intent_id"
    );

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

  const authenticationElement =
    await sdk.authenticate(
      normalizedAuthIntentId,
      (
        result
      ) => {
        if (
          result?.result ===
            "success"
        ) {
          try {
            const cryptoCustomerId =
              requireString(
                result
                  ?.crypto_customer_id,
                "missing_crypto_customer_id"
              );

            resolveCompletion({
              authIntentId:
                normalizedAuthIntentId,

              cryptoCustomerId
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
              "stripe_link_authentication_abandoned"
            )
          );

          return;
        }

        if (
          result?.result ===
            "declined"
        ) {
          rejectCompletion(
            new Error(
              "stripe_link_authentication_declined"
            )
          );

          return;
        }

        const error =
          new Error(
            "stripe_link_authentication_failed"
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
    !authenticationElement
  ) {
    throw new Error(
      "stripe_authentication_element_missing"
    );
  }

  return {
    element:
      authenticationElement,

    completion
  };
}


/*
--------------------------------------------------
Load / reload CryptoCustomer

Backend exchanges the authenticated LinkAuthIntent
for OAuth tokens and retrieves the CryptoCustomer.

The browser request is authenticated with Clerk.

OAuth access/refresh tokens remain backend-only.
--------------------------------------------------
*/

export async function loadStripeCryptoCustomer({
  authIntentId,
  cryptoCustomerId
} = {}) {
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

  const payload =
    await stripeBrowserPostJson(
      CUSTOMER_CONTEXT_URL,
      {
        authIntentId:
          normalizedAuthIntentId,

        cryptoCustomerId:
          normalizedCryptoCustomerId
      },
      {
        errorPrefix:
          "stripe_customer_context"
      }
    );

  return {
    cryptoCustomerId:
      requireString(
        payload?.cryptoCustomerId ??
        payload?.id ??
        normalizedCryptoCustomerId,
        "missing_crypto_customer_id"
      ),

    object:
      payload?.object ??
      null,

    livemode:
      payload?.livemode ??
      null,

    verifications:
      Array.isArray(
        payload?.verifications
      )
        ? payload.verifications
        : [],

    providedFields:
      Array.isArray(
        payload?.providedFields
      )
        ? payload.providedFields
        : []
  };
}


/*
--------------------------------------------------
Verification helpers
--------------------------------------------------
*/

export function getStripeVerificationStatus(
  customer,
  verificationName
) {
  const normalizedName =
    normalizeString(
      verificationName
    )
      .toLowerCase();

  if (
    !normalizedName
  ) {
    return null;
  }

  const verification =
    (
      Array.isArray(
        customer?.verifications
      )
        ? customer.verifications
        : []
    )
      .find(
        (
          item
        ) =>
          normalizeString(
            item?.name
          )
            .toLowerCase() ===
          normalizedName
      );

  return (
    normalizeString(
      verification?.status
    )
      .toLowerCase() ||
    null
  );
}


export function isStripeVerificationVerified(
  customer,
  verificationName
) {
  return (
    getStripeVerificationStatus(
      customer,
      verificationName
    ) ===
    "verified"
  );
}
