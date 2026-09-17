// unibridge-landing/surface/js/stripe-link-test/stripeFunding.js

/*
--------------------------------------------------
Stripe diagnostic — funding / checkout layer

Owns ONLY:

- settlement-bound Stripe transaction limits
- ACH payment-method collection
- cryptoPaymentToken state
- Headless Session creation
- Headless Session response normalization
- performCheckout()

Does NOT own:

- Stripe browser config
- Stripe SDK initialization
- Link registration
- Link authentication
- CryptoCustomer loading
- KYC submission
- document verification
- Clerk session recovery
- sandbox settlement creation
- flow-button policy

Shared state owned by orchestrator:

state.authIntentId
state.cryptoCustomerId
state.stripeKycVerified
state.stripeDocumentVerified
state.sandboxDiagnosticSettlementId
state.achLimitsAvailable
state.transactionLimits
state.cryptoPaymentToken
state.headlessSession
state.checkoutCompleted

Important:

- Browser never supplies canonical funding amount.
- Browser never supplies canonical wallet.
- Browser never supplies canonical network.
- Browser never supplies canonical currencies.
- Backend resolves those from settlement state.
- cryptoPaymentToken is never logged.
- client_secret is never logged.
- Checkout success means submitted / initiated,
  NOT funding_confirmed.
--------------------------------------------------
*/


/*
--------------------------------------------------
Constants
--------------------------------------------------
*/

const TRANSACTION_LIMITS_URL =
  "/v2/ramp/stripe/browser/transaction-limits";

const HEADLESS_SESSION_URL =
  "/v2/ramp/stripe/browser/headless-session";


/*
--------------------------------------------------
Basic helpers
--------------------------------------------------
*/

function normalizeString(
  value
) {
  return String(
    value ?? ""
  ).trim();
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


function requireString(
  value,
  code
) {
  const normalized =
    normalizeString(
      value
    );

  if (!normalized) {
    throw new Error(
      code
    );
  }

  return normalized;
}


function createHttpError(
  response,
  payload,
  fallbackCode
) {
  const error =
    new Error(
      payload?.error?.message ||
      payload?.message ||
      fallbackCode
    );

  error.status =
    response?.status ??
    null;

  error.payload =
    payload ??
    null;

  return error;
}


/*
--------------------------------------------------
Headless Session response normalization

The browser needs:

- session_id
- client_secret
- transaction details / quote

client_secret stays only in memory and is never logged.
--------------------------------------------------
*/

function normalizeHeadlessSessionPayload(
  payload,
  settlementId
) {
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

  const clientSecret =
    requireString(
      session?.client_secret,
      "stripe_headless_session_missing_client_secret"
    );

  return {
    settlementId:
      responseSettlementId,

    sessionId,

    clientSecret,

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
Factory
--------------------------------------------------
*/

export function createStripeFundingFlow({
  state,
  ui,
  ensureSdk,
  getAuthenticatedJsonHeaders,
  ensureSandboxDiagnosticSettlement,
  requireDiagnosticSettlementId,
  resolveDiagnosticSettlementId,
  resetPaymentMethodState,
  resetCheckoutState,
  onStateChange = null
} = {}) {
  if (
    !state ||
    typeof state !==
      "object"
  ) {
    throw new Error(
      "stripe_funding_state_required"
    );
  }

  if (
    !ui ||
    typeof ui !==
      "object"
  ) {
    throw new Error(
      "stripe_funding_ui_required"
    );
  }

  if (
    typeof ensureSdk !==
      "function"
  ) {
    throw new Error(
      "stripe_funding_ensure_sdk_required"
    );
  }

  if (
    typeof getAuthenticatedJsonHeaders !==
      "function"
  ) {
    throw new Error(
      "stripe_funding_auth_headers_required"
    );
  }

  if (
    typeof ensureSandboxDiagnosticSettlement !==
      "function"
  ) {
    throw new Error(
      "stripe_funding_sandbox_settlement_required"
    );
  }

  if (
    typeof requireDiagnosticSettlementId !==
      "function"
  ) {
    throw new Error(
      "stripe_funding_require_settlement_required"
    );
  }

  if (
    typeof resolveDiagnosticSettlementId !==
      "function"
  ) {
    throw new Error(
      "stripe_funding_resolve_settlement_required"
    );
  }

  if (
    typeof resetPaymentMethodState !==
      "function"
  ) {
    throw new Error(
      "stripe_funding_reset_payment_method_required"
    );
  }

  if (
    typeof resetCheckoutState !==
      "function"
  ) {
    throw new Error(
      "stripe_funding_reset_checkout_required"
    );
  }

  if (
    onStateChange !==
      null &&
    typeof onStateChange !==
      "function"
  ) {
    throw new Error(
      "stripe_funding_on_state_change_invalid"
    );
  }


  /*
  --------------------------------------------------
  State-change notification

  Funding SDK callbacks may mutate shared state after
  the original click handler has already returned.

  The orchestrator owns button policy, so this module
  merely signals that shared state changed.
  --------------------------------------------------
  */

  function notifyStateChange() {
    if (
      typeof onStateChange ===
        "function"
    ) {
      onStateChange();
    }
  }


  /*
  --------------------------------------------------
  Mode helpers
  --------------------------------------------------
  */

  function isSandboxMode() {
    return Boolean(
      state.browserConfig?.mode ===
        "sandbox" &&
      state.browserConfig?.isSandbox ===
        true
    );
  }


  function requireSandboxMode(
    code =
      "stripe_funding_sandbox_only"
  ) {
    if (
      !isSandboxMode()
    ) {
      throw new Error(
        code
      );
    }
  }


  /*
  --------------------------------------------------
  Local availability projections

  These are used only for operation-specific status
  output.

  The orchestrator remains authoritative for actual
  button enable/disable policy.
  --------------------------------------------------
  */

  function canCollectAch() {
    return Boolean(
      isSandboxMode() &&
      state.stripeKycVerified &&
      state.stripeDocumentVerified &&
      state.achLimitsAvailable
    );
  }


  function canCreateHeadlessSession() {
    return Boolean(
      isSandboxMode() &&
      state.stripeKycVerified &&
      state.stripeDocumentVerified &&
      state.achLimitsAvailable &&
      state.cryptoPaymentToken &&
      state.sandboxDiagnosticSettlementId
    );
  }


  function canPerformCheckout() {
    return Boolean(
      isSandboxMode() &&
      state.headlessSession?.sessionId &&
      state.headlessSession?.clientSecret &&
      state.checkoutCompleted !==
        true
    );
  }


  /*
  --------------------------------------------------
  Settlement-bound Stripe transaction limits

  Sandbox:
  → create/reuse authenticated diagnostic settlement.

  Live safe diagnostic:
  → require explicit URL settlement.

  Browser sends ONLY:
  - settlementId
  - authIntentId
  - cryptoCustomerId

  Backend resolves:
  - canonical amount
  - wallet
  - network
  - currencies
  --------------------------------------------------
  */

  async function loadTransactionLimits() {
    const normalizedAuthIntentId =
      requireString(
        state.authIntentId,
        "missing_auth_intent_id"
      );

    const normalizedCryptoCustomerId =
      requireString(
        state.cryptoCustomerId,
        "missing_crypto_customer_id"
      );

    if (
      state.stripeKycVerified !==
        true
    ) {
      throw new Error(
        "stripe_kyc_not_verified"
      );
    }

    if (
      state.stripeDocumentVerified !==
        true
    ) {
      throw new Error(
        "stripe_l2_document_verification_required"
      );
    }


    /*
    --------------------------------------------------
    Resolve settlement before limits request.

    Sandbox settlement creation itself is authenticated.
    --------------------------------------------------
    */

    const settlementId =
      isSandboxMode()
        ? await ensureSandboxDiagnosticSettlement()
        : requireDiagnosticSettlementId();


    ui.setStatus(
      `Loading settlement-bound Stripe ACH transaction limits (${state.browserConfig?.mode ?? "unknown"})...`,
      {
        settlementId,

        sandboxDiagnostic:
          isSandboxMode()
      }
    );


    /*
    --------------------------------------------------
    Limits reload invalidates all downstream funding
    artifacts.

    A previous payment token / Headless Session must
    never survive a fresh limits check.
    --------------------------------------------------
    */

    state.achLimitsAvailable =
      false;

    state.transactionLimits =
      null;

    resetPaymentMethodState();

    notifyStateChange();


    const headers =
      await getAuthenticatedJsonHeaders();

    const response =
      await fetch(
        TRANSACTION_LIMITS_URL,
        {
          method:
            "POST",

          headers,

          body:
            JSON.stringify({
              settlementId,

              authIntentId:
                normalizedAuthIntentId,

              cryptoCustomerId:
                normalizedCryptoCustomerId
            })
        }
      );

    const payload =
      await response
        .json()
        .catch(
          () =>
            null
        );

    if (
      !response.ok
    ) {
      throw createHttpError(
        response,
        payload,
        `transaction_limits_http_${response.status}`
      );
    }


    /*
    --------------------------------------------------
    Settlement binding
    --------------------------------------------------
    */

    const responseSettlementId =
      requireString(
        payload?.settlement_id,
        "transaction_limits_missing_settlement_id"
      );

    if (
      responseSettlementId !==
        settlementId
    ) {
      throw new Error(
        "transaction_limits_settlement_mismatch"
      );
    }


    /*
    --------------------------------------------------
    Current diagnostic contract:

    USD
    +
    us_bank_account
    --------------------------------------------------
    */

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
        "transaction_limits_invalid_currency"
      );
    }

    if (
      paymentMethod !==
        "us_bank_account"
    ) {
      throw new Error(
        "transaction_limits_invalid_payment_method"
      );
    }


    state.achLimitsAvailable =
      payload?.available ===
      true;

    state.transactionLimits = {
      settlementId:
        responseSettlementId,

      currency,

      paymentMethod,

      available:
        state.achLimitsAvailable,

      limits:
        Array.isArray(
          payload?.limits
        )
          ? payload.limits
          : []
    };

    notifyStateChange();


    console.log(
      "STRIPE_TRANSACTION_LIMITS",
      {
        settlement_id:
          state.transactionLimits
            .settlementId,

        currency:
          state.transactionLimits
            .currency,

        payment_method:
          state.transactionLimits
            .paymentMethod,

        available:
          state.transactionLimits
            .available,

        limits:
          state.transactionLimits
            .limits
      }
    );


    ui.setStatus(
      "Stripe ACH transaction limits loaded.",
      {
        mode:
          state.browserConfig?.mode ??
          null,

        settlementId:
          state.transactionLimits
            .settlementId,

        sandboxDiagnostic:
          isSandboxMode(),

        currency:
          state.transactionLimits
            .currency,

        paymentMethod:
          state.transactionLimits
            .paymentMethod,

        available:
          state.transactionLimits
            .available,

        limits:
          state.transactionLimits
            .limits,

        l2Verified:
          true,

        achCollectionEnabled:
          canCollectAch(),

        nextStep:
          state.transactionLimits
            .available
            ? isSandboxMode()
              ? "ACH is available. Collect ACH payment method."
              : "ACH limits are available. Live diagnostic remains read-only after this step."
            : "ACH limit is still unavailable after L2 verification."
      }
    );

    return state.transactionLimits;
  }


  /*
  --------------------------------------------------
  Collect ACH payment method

  Sandbox only.

  Stripe callback may fire asynchronously after this
  function returns the mounted element.

  On successful callback:
  → save cryptoPaymentToken in memory
  → never log token
  → notify orchestrator that state changed
  --------------------------------------------------
  */

  async function collectAchPaymentMethod() {
    requireSandboxMode(
      "ach_collection_disabled_in_live_mode"
    );

    const sdk =
      await ensureSdk();

    requireString(
      state.cryptoCustomerId,
      "missing_crypto_customer_id"
    );

    if (
      state.stripeKycVerified !==
        true ||
      state.stripeDocumentVerified !==
        true
    ) {
      throw new Error(
        "stripe_l2_verification_required"
      );
    }

    if (
      state.achLimitsAvailable !==
        true
    ) {
      throw new Error(
        "stripe_ach_limits_not_available"
      );
    }

    if (
      typeof sdk.collectPaymentMethod !==
        "function"
    ) {
      throw new Error(
        "collectPaymentMethod_not_available"
      );
    }


    resetPaymentMethodState();

    notifyStateChange();

    ui.setStatus(
      "Collecting ACH payment method..."
    );

    ui.clearStripeContainer();


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


          /*
          --------------------------------------------------
          Successful payment-method collection
          --------------------------------------------------
          */

          if (token) {
            state.cryptoPaymentToken =
              requireString(
                token,
                "missing_crypto_payment_token"
              );

            notifyStateChange();

            console.log(
              "STRIPE_PAYMENT_METHOD_READY",
              {
                payment_token_ready:
                  true
              }
            );

            ui.setStatus(
              "ACH payment method collected.",
              {
                settlementId:
                  resolveDiagnosticSettlementId(),

                l2Verified:
                  true,

                achLimitsAvailable:
                  state.achLimitsAvailable,

                cryptoPaymentTokenReady:
                  true,

                headlessSessionEnabled:
                  canCreateHeadlessSession(),

                nextStep:
                  "Create ACH Headless Session + Quote."
              }
            );

            return;
          }


          /*
          --------------------------------------------------
          User abandoned collection
          --------------------------------------------------
          */

          if (
            result?.result ===
              "abandoned"
          ) {
            ui.setStatus(
              "ACH payment-method collection abandoned."
            );

            notifyStateChange();

            return;
          }


          /*
          --------------------------------------------------
          Stripe callback error
          --------------------------------------------------
          */

          if (
            result?.error
          ) {
            ui.setStatus(
              "ACH payment-method collection failed.",
              {
                message:
                  result?.error?.message ??
                  "stripe_ach_collection_failed"
              }
            );

            notifyStateChange();

            return;
          }


          /*
          --------------------------------------------------
          Unknown callback without token
          --------------------------------------------------
          */

          ui.setStatus(
            "ACH payment-method callback received without a payment token."
          );

          notifyStateChange();
        }
      );


    if (
      paymentElement
    ) {
      ui.mountStripeElement(
        paymentElement
      );
    }

    return paymentElement;
  }


  /*
  --------------------------------------------------
  Create settlement-bound ACH Headless Session

  Sandbox only.

  Browser sends:
  - settlementId
  - authIntentId
  - cryptoCustomerId
  - paymentToken

  Backend owns canonical transaction facts and creates
  the Stripe Headless Session.

  Returned transaction details are the quote.
  --------------------------------------------------
  */

  async function createHeadlessSession() {
    requireSandboxMode(
      "headless_session_disabled_in_live_mode"
    );

    const settlementId =
      requireDiagnosticSettlementId();

    const normalizedAuthIntentId =
      requireString(
        state.authIntentId,
        "missing_auth_intent_id"
      );

    const normalizedCryptoCustomerId =
      requireString(
        state.cryptoCustomerId,
        "missing_crypto_customer_id"
      );

    const normalizedCryptoPaymentToken =
      requireString(
        state.cryptoPaymentToken,
        "missing_crypto_payment_token"
      );

    if (
      state.stripeKycVerified !==
        true ||
      state.stripeDocumentVerified !==
        true
    ) {
      throw new Error(
        "stripe_l2_verification_required"
      );
    }

    if (
      state.achLimitsAvailable !==
        true
    ) {
      throw new Error(
        "stripe_ach_limits_not_available"
      );
    }


    resetCheckoutState();

    notifyStateChange();


    ui.setStatus(
      "Creating settlement-bound ACH Headless Session...",
      {
        settlementId,

        sandboxDiagnostic:
          true
      }
    );


    const headers =
      await getAuthenticatedJsonHeaders();

    const response =
      await fetch(
        HEADLESS_SESSION_URL,
        {
          method:
            "POST",

          headers,

          body:
            JSON.stringify({
              settlementId,

              authIntentId:
                normalizedAuthIntentId,

              cryptoCustomerId:
                normalizedCryptoCustomerId,

              paymentToken:
                normalizedCryptoPaymentToken
            })
        }
      );

    const payload =
      await response
        .json()
        .catch(
          () =>
            null
        );

    if (
      !response.ok
    ) {
      throw createHttpError(
        response,
        payload,
        `headless_session_http_${response.status}`
      );
    }


    state.headlessSession =
      normalizeHeadlessSessionPayload(
        payload,
        settlementId
      );

    state.checkoutCompleted =
      false;

    notifyStateChange();


    /*
    --------------------------------------------------
    SAFE LOG

    clientSecret intentionally omitted.
    cryptoPaymentToken intentionally omitted.
    --------------------------------------------------
    */

    console.log(
      "STRIPE_ACH_HEADLESS_SESSION_READY",
      {
        settlement_id:
          state.headlessSession
            .settlementId,

        session_id:
          state.headlessSession
            .sessionId,

        status:
          state.headlessSession
            .status,

        livemode:
          state.headlessSession
            .livemode,

        source_amount:
          state.headlessSession
            .sourceAmount,

        source_currency:
          state.headlessSession
            .sourceCurrency,

        destination_amount:
          state.headlessSession
            .destinationAmount,

        destination_currency:
          state.headlessSession
            .destinationCurrency,

        destination_network:
          state.headlessSession
            .destinationNetwork,

        quote_expiration:
          state.headlessSession
            .quoteExpiration,

        client_secret_ready:
          true
      }
    );


    ui.setStatus(
      "ACH Headless Session and settlement-bound quote created.",
      {
        settlementId:
          state.headlessSession
            .settlementId,

        sessionId:
          state.headlessSession
            .sessionId,

        status:
          state.headlessSession
            .status,

        livemode:
          state.headlessSession
            .livemode,

        quote: {
          sourceAmount:
            state.headlessSession
              .sourceAmount,

          sourceCurrency:
            state.headlessSession
              .sourceCurrency,

          destinationAmount:
            state.headlessSession
              .destinationAmount,

          destinationCurrency:
            state.headlessSession
              .destinationCurrency,

          destinationNetwork:
            state.headlessSession
              .destinationNetwork,

          quoteExpiration:
            state.headlessSession
              .quoteExpiration
        },

        clientSecretReady:
          true,

        checkoutEnabled:
          canPerformCheckout(),

        nextStep:
          "Perform Checkout."
      }
    );

    return state.headlessSession;
  }


  /*
  --------------------------------------------------
  Perform checkout

  Sandbox only.

  performCheckout receives:

  session ID
  +
  callback returning that session's client secret

  The callback rejects any unexpected session ID.

  Successful checkout means Stripe accepted/submitted
  the funding operation.

  It does NOT mean ACH funds have settled.

  Backend monitoring owns:
  waiting_ramp_payment
  → funding_confirmed
  --------------------------------------------------
  */

  async function performCheckout() {
    requireSandboxMode(
      "checkout_disabled_in_live_mode"
    );

    const sdk =
      await ensureSdk();

    if (
      typeof sdk.performCheckout !==
        "function"
    ) {
      throw new Error(
        "performCheckout_not_available"
      );
    }

    if (
      !state.headlessSession
    ) {
      throw new Error(
        "missing_headless_session"
      );
    }

    const sessionId =
      requireString(
        state.headlessSession
          .sessionId,
        "stripe_checkout_missing_session_id"
      );

    const clientSecret =
      requireString(
        state.headlessSession
          .clientSecret,
        "stripe_checkout_missing_client_secret"
      );


    ui.setStatus(
      "Performing Stripe ACH checkout..."
    );


    const result =
      await sdk.performCheckout(
        sessionId,

        async (
          requestedSessionId
        ) => {
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

          return clientSecret;
        }
      );


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


    state.checkoutCompleted =
      true;

    notifyStateChange();


    console.log(
      "STRIPE_HEADLESS_CHECKOUT_COMPLETED",
      {
        settlement_id:
          state.headlessSession
            .settlementId,

        session_id:
          state.headlessSession
            .sessionId,

        successful:
          true
      }
    );


    ui.setStatus(
      "Stripe ACH checkout completed.",
      {
        settlementId:
          state.headlessSession
            .settlementId,

        sessionId:
          state.headlessSession
            .sessionId,

        successful:
          true,

        nextStep:
          "Verify backend funding confirmation / settlement lifecycle. Checkout success does not itself mean funding_confirmed."
      }
    );


    return {
      successful:
        true
    };
  }


  /*
  --------------------------------------------------
  Public contract
  --------------------------------------------------
  */

  return {
    loadTransactionLimits,
    collectAchPaymentMethod,
    createHeadlessSession,
    performCheckout
  };
}
