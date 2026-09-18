// unibrij/unibridge-landing/surface/js/ramp/stripeEmbedded/stripeLimits.js

import {
  stripeBrowserPostJson
} from "./stripeBrowserApi.js";


const TRANSACTION_LIMITS_URL =
  "/v2/ramp/stripe/browser/transaction-limits";


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
Load settlement-bound Stripe ACH limits

Browser supplies only:

  settlementId
  authIntentId
  cryptoCustomerId

Wallet, destination network and funding amount remain
canonical backend-owned settlement funding facts.

Authentication is supplied by stripeBrowserApi.
--------------------------------------------------
*/

export async function loadStripeTransactionLimits({
  settlementId,
  authIntentId,
  cryptoCustomerId
} = {}) {
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

  const payload =
    await stripeBrowserPostJson(
      TRANSACTION_LIMITS_URL,
      {
        settlementId:
          normalizedSettlementId,

        authIntentId:
          normalizedAuthIntentId,

        cryptoCustomerId:
          normalizedCryptoCustomerId
      },
      {
        errorPrefix:
          "stripe_limits"
      }
    );

  const responseSettlementId =
    requireString(
      payload?.settlement_id,
      "missing_settlement_id"
    );

  if (
    responseSettlementId !==
      normalizedSettlementId
  ) {
    throw new Error(
      "stripe_limits_settlement_mismatch"
    );
  }

  const currency =
    normalizeString(
      payload?.currency
    )
      .toLowerCase();

  const paymentMethod =
    normalizeString(
      payload?.payment_method
    )
      .toLowerCase();

  if (
    currency !==
      "usd"
  ) {
    throw new Error(
      "stripe_limits_invalid_currency"
    );
  }

  if (
    paymentMethod !==
      "us_bank_account"
  ) {
    throw new Error(
      "stripe_limits_invalid_payment_method"
    );
  }

  return {
    settlementId:
      responseSettlementId,

    currency,

    paymentMethod,

    available:
      payload?.available ===
      true,

    limits:
      Array.isArray(
        payload?.limits
      )
        ? payload.limits
            .filter(
              (
                item
              ) =>
                item &&
                typeof item ===
                  "object"
            )
            .map(
              (
                item
              ) => ({
                limit:
                  item.limit ??
                  null,

                settlementSpeed:
                  normalizeString(
                    item.settlement_speed
                  ) ||
                  null
              })
            )
        : []
  };
}
