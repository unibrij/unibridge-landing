// unibridge-landing/surface/js/ramp/stripeEmbedded/stripeConsumerWallet.js

import {
  stripeBrowserPostJson
} from "./stripeBrowserApi.js";


const STRIPE_WALLET_CONTEXT_URL =
  "/v2/ramp/stripe/browser/wallet-context";


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


function normalizeNetwork(
  value
) {
  return requireString(
    value,
    "stripe_consumer_wallet_network_missing"
  )
    .toLowerCase();
}


function normalizeWalletContext({
  payload,
  settlementId,
  cryptoCustomerId
}) {
  if (
    !payload ||
    typeof payload !==
      "object"
  ) {
    throw new Error(
      "stripe_wallet_context_invalid_response"
    );
  }

  const responseSettlementId =
    requireString(
      payload?.settlement_id,
      "stripe_wallet_context_missing_settlement_id"
    );

  if (
    responseSettlementId !==
      settlementId
  ) {
    throw new Error(
      "stripe_wallet_context_settlement_mismatch"
    );
  }

  const responseCryptoCustomerId =
    requireString(
      payload?.crypto_customer_id,
      "stripe_wallet_context_missing_crypto_customer_id"
    );

  if (
    responseCryptoCustomerId !==
      cryptoCustomerId
  ) {
    throw new Error(
      "stripe_wallet_context_customer_mismatch"
    );
  }

  const walletAddress =
    requireString(
      payload?.wallet_address,
      "stripe_wallet_context_missing_wallet_address"
    );

  const network =
    normalizeNetwork(
      payload?.network
    );

  /*
  --------------------------------------------------
  Never allow UniBridge's internal derivation network
  abstraction to cross into Stripe.

  Polygon funding must reach Stripe as "polygon",
  never "evm".
  --------------------------------------------------
  */

  if (
    network ===
      "evm"
  ) {
    throw new Error(
      "stripe_wallet_context_invalid_network"
    );
  }

  return {
    settlementId:
      responseSettlementId,

    cryptoCustomerId:
      responseCryptoCustomerId,

    walletAddress,

    network,

    registered:
      payload?.registered ===
      true,

    consumerWalletId:
      normalizeString(
        payload?.consumer_wallet_id
      ) ||
      null
  };
}


async function loadStripeWalletContext({
  settlementId,
  authIntentId,
  cryptoCustomerId
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

  const payload =
    await stripeBrowserPostJson(
      STRIPE_WALLET_CONTEXT_URL,
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
          "stripe_wallet_context"
      }
    );

  return normalizeWalletContext({
    payload,

    settlementId:
      normalizedSettlementId,

    cryptoCustomerId:
      normalizedCryptoCustomerId
  });
}


function buildRegistrationError(
  result
) {
  const message =
    normalizeString(
      result?.error?.message
    ) ||
    normalizeString(
      result?.message
    ) ||
    normalizeString(
      result?.error
    ) ||
    "stripe_consumer_wallet_registration_failed";

  const error =
    new Error(
      message
    );

  error.payload =
    result ??
    null;

  return error;
}


/*
--------------------------------------------------
Ensure settlement-bound ConsumerWallet

The backend owns the canonical:

  wallet address
  network

The browser never supplies or chooses either value.

Flow:

  wallet-context
  → already registered?
      yes → return
      no  → require Stripe registration capability
  → Stripe SDK registerWalletAddress(...)
  → wallet-context again
  → require registered=true

The second backend check makes this operation safe
for retries and verifies Stripe actually associated
the wallet with the current CryptoCustomer.
--------------------------------------------------
*/

export async function ensureStripeConsumerWallet({
  sdk,
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

  /*
  --------------------------------------------------
  First ask the backend whether Stripe already knows
  this exact canonical settlement wallet.

  If it is already registered, the SDK does not need
  to expose registerWalletAddress at all.
  --------------------------------------------------
  */

  const initialContext =
    await loadStripeWalletContext({
      settlementId:
        normalizedSettlementId,

      authIntentId:
        normalizedAuthIntentId,

      cryptoCustomerId:
        normalizedCryptoCustomerId
    });

  if (
    initialContext.registered
  ) {
    return initialContext;
  }

  /*
  --------------------------------------------------
  Registration capability is required only when the
  wallet is actually missing from Stripe.
  --------------------------------------------------
  */

  if (
    !sdk ||
    typeof sdk.registerWalletAddress !==
      "function"
  ) {
    throw new Error(
      "stripe_register_wallet_address_not_available"
    );
  }

  /*
  --------------------------------------------------
  Stripe Web SDK contract:

    registerWalletAddress(
      walletAddress,
      network
    )

  Registration presents no UI.
  --------------------------------------------------
  */

  const registrationResult =
    await sdk.registerWalletAddress(
      initialContext.walletAddress,
      initialContext.network
    );

  /*
  --------------------------------------------------
  Successful registration may not require a specific
  response shape.

  Treat an explicit returned error as failure.

  The authoritative confirmation is the backend list
  check immediately below.
  --------------------------------------------------
  */

  if (
    registrationResult
      ?.error
  ) {
    throw buildRegistrationError(
      registrationResult
    );
  }

  /*
  --------------------------------------------------
  Re-check through the backend.

  This confirms that Stripe now associates the exact
  canonical wallet with the current CryptoCustomer.
  --------------------------------------------------
  */

  const confirmedContext =
    await loadStripeWalletContext({
      settlementId:
        normalizedSettlementId,

      authIntentId:
        normalizedAuthIntentId,

      cryptoCustomerId:
        normalizedCryptoCustomerId
    });

  if (
    !confirmedContext.registered
  ) {
    throw new Error(
      "stripe_consumer_wallet_registration_not_confirmed"
    );
  }

  /*
  --------------------------------------------------
  The canonical settlement target must not change
  during registration.
  --------------------------------------------------
  */

  if (
    confirmedContext.walletAddress !==
      initialContext.walletAddress ||
    confirmedContext.network !==
      initialContext.network
  ) {
    throw new Error(
      "stripe_consumer_wallet_context_changed"
    );
  }

  return confirmedContext;
}


export {
  loadStripeWalletContext
};


export default Object.freeze({
  loadStripeWalletContext,
  ensureStripeConsumerWallet
});
