// unibridge-landing/surface/js/stripe-link-test/stripeCustomer.js

/*
--------------------------------------------------
Stripe diagnostic — customer / identity layer

Owns ONLY:

- Stripe browser configuration
- Stripe Embedded Components SDK initialization
- sandbox Link-user registration
- LinkAuthIntent creation
- Link authentication
- CryptoCustomer loading
- Stripe verification-state parsing

Does NOT own:

- Clerk authentication
- KYC submission
- document verification
- diagnostic settlement creation
- transaction limits
- ACH collection
- Headless Session
- checkout
- flow-button policy

Shared state owned by orchestrator:

state.browserConfig
state.onramp
state.authIntentId
state.cryptoCustomerId
state.stripeKycVerified
state.stripeDocumentVerificationStatus
state.stripeDocumentVerified
--------------------------------------------------
*/


/*
--------------------------------------------------
Constants
--------------------------------------------------
*/

const STRIPE_CRYPTO_MODULE =
  "https://cdn.jsdelivr.net/npm/@stripe/crypto@1.1.0/+esm";

const STRIPE_BROWSER_CONFIG_URL =
  "/v2/ramp/stripe/browser/config";

const CREATE_LINK_AUTH_INTENT_URL =
  "/v2/ramp/stripe/browser/link-auth-intent";

const CUSTOMER_CONTEXT_URL =
  "/v2/ramp/stripe/browser/customer-context";

const TEST_COUNTRY =
  "US";


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
Verification parsing

Stripe returns verification objects similar to:

[
  {
    name: "kyc_verified",
    status: "verified"
  },
  {
    name: "id_document_verified",
    status: "verified"
  }
]
--------------------------------------------------
*/

function getVerificationStatus(
  payload,
  verificationName
) {
  const normalizedName =
    normalizeString(
      verificationName
    )
      .toLowerCase();

  if (!normalizedName) {
    return null;
  }

  const verifications =
    Array.isArray(
      payload?.verifications
    )
      ? payload.verifications
      : [];

  const verification =
    verifications.find(
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
    normalizeOptionalString(
      verification?.status
    )
      ?.toLowerCase() ??
    null
  );
}


function isKycVerified(
  payload
) {
  return (
    getVerificationStatus(
      payload,
      "kyc_verified"
    ) ===
    "verified"
  );
}


function getDocumentVerificationStatus(
  payload
) {
  return getVerificationStatus(
    payload,
    "id_document_verified"
  );
}


function isDocumentVerified(
  payload
) {
  return (
    getDocumentVerificationStatus(
      payload
    ) ===
    "verified"
  );
}


/*
--------------------------------------------------
Factory
--------------------------------------------------
*/

export function createStripeCustomerFlow({
  state,
  ui,
  resetStripeCustomerState,
  resetLimitsState
} = {}) {
  if (
    !state ||
    typeof state !==
      "object"
  ) {
    throw new Error(
      "stripe_customer_state_required"
    );
  }

  if (
    !ui ||
    typeof ui !==
      "object"
  ) {
    throw new Error(
      "stripe_customer_ui_required"
    );
  }

  if (
    typeof resetStripeCustomerState !==
      "function"
  ) {
    throw new Error(
      "reset_stripe_customer_state_required"
    );
  }

  if (
    typeof resetLimitsState !==
      "function"
  ) {
    throw new Error(
      "reset_limits_state_required"
    );
  }


  /*
  --------------------------------------------------
  Local async-load state

  Promises belong to this module rather than the shared
  business state because they are implementation details.
  --------------------------------------------------
  */

  let browserConfigLoadPromise =
    null;

  let sdkLoadPromise =
    null;


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


  function isLiveMode() {
    return Boolean(
      state.browserConfig?.mode ===
        "live" &&
      state.browserConfig?.isSandbox ===
        false
    );
  }


  function requireSandboxMode(
    code =
      "sandbox_only_action"
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
  Browser config
  --------------------------------------------------
  */

  async function loadBrowserConfig() {
    if (
      state.browserConfig
    ) {
      return state.browserConfig;
    }

    if (
      browserConfigLoadPromise
    ) {
      return browserConfigLoadPromise;
    }

    browserConfigLoadPromise =
      fetch(
        STRIPE_BROWSER_CONFIG_URL,
        {
          method:
            "GET",

          headers: {
            Accept:
              "application/json"
          },

          cache:
            "no-store"
        }
      )
        .then(
          async (
            response
          ) => {
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
                `stripe_browser_config_http_${response.status}`
              );
            }

            const mode =
              requireString(
                payload?.mode,
                "missing_stripe_mode"
              )
                .toLowerCase();

            if (
              mode !==
                "sandbox" &&
              mode !==
                "live"
            ) {
              throw new Error(
                "invalid_stripe_mode"
              );
            }

            if (
              typeof payload?.isSandbox !==
                "boolean"
            ) {
              throw new Error(
                "invalid_stripe_is_sandbox"
              );
            }

            const isSandbox =
              payload.isSandbox;

            if (
              (
                mode ===
                  "sandbox" &&
                isSandbox !==
                  true
              ) ||
              (
                mode ===
                  "live" &&
                isSandbox !==
                  false
              )
            ) {
              throw new Error(
                "stripe_mode_sandbox_flag_mismatch"
              );
            }

            const publishableKey =
              requireString(
                payload?.publishableKey,
                "missing_stripe_publishable_key"
              );

            if (
              !publishableKey.startsWith(
                "pk_"
              )
            ) {
              throw new Error(
                "invalid_stripe_publishable_key"
              );
            }

            if (
              mode ===
                "sandbox" &&
              !publishableKey.startsWith(
                "pk_test_"
              )
            ) {
              throw new Error(
                "stripe_sandbox_publishable_key_mismatch"
              );
            }

            if (
              mode ===
                "live" &&
              !publishableKey.startsWith(
                "pk_live_"
              )
            ) {
              throw new Error(
                "stripe_live_publishable_key_mismatch"
              );
            }

            state.browserConfig = {
              mode,
              isSandbox,
              publishableKey
            };

            console.log(
              "STRIPE_BROWSER_CONFIG",
              {
                mode:
                  state.browserConfig.mode,

                isSandbox:
                  state.browserConfig.isSandbox,

                publishableKeyType:
                  publishableKey
                    .startsWith(
                      "pk_live_"
                    )
                    ? "live"
                    : "test"
              }
            );

            return state.browserConfig;
          }
        )
        .catch(
          (
            error
          ) => {
            browserConfigLoadPromise =
              null;

            state.browserConfig =
              null;

            throw error;
          }
        );

    return browserConfigLoadPromise;
  }


  /*
  --------------------------------------------------
  Stripe SDK
  --------------------------------------------------
  */

  async function ensureSdk() {
    if (
      state.onramp
    ) {
      return state.onramp;
    }

    if (
      sdkLoadPromise
    ) {
      return sdkLoadPromise;
    }

    sdkLoadPromise =
      (
        async () => {
          const config =
            await loadBrowserConfig();

          const module =
            await import(
              STRIPE_CRYPTO_MODULE
            );

          console.log(
            "STRIPE_CRYPTO_MODULE_EXPORTS",
            Object.keys(
              module ?? {}
            )
          );

          const initialize =
            module
              ?.loadCryptoOnrampAndInitialize;

          if (
            typeof initialize !==
              "function"
          ) {
            throw new Error(
              "loadCryptoOnrampAndInitialize_not_exported"
            );
          }

          const instance =
            await initialize(
              config.publishableKey,
              {
                theme:
                  "stripe"
              }
            );

          if (!instance) {
            throw new Error(
              "stripe_embedded_components_initialization_failed"
            );
          }

          state.onramp =
            instance;

          return state.onramp;
        }
      )()
        .catch(
          (
            error
          ) => {
            sdkLoadPromise =
              null;

            state.onramp =
              null;

            throw error;
          }
        );

    return sdkLoadPromise;
  }


  /*
  --------------------------------------------------
  Registration input

  fullName is retained as a required diagnostic input
  because that was the behavior of the original page,
  even though registerLinkUser() currently receives only:

  email
  phone
  country
  --------------------------------------------------
  */

  function getRegistrationInfo() {
    if (
      typeof ui.getRegistrationValues !==
        "function"
    ) {
      throw new Error(
        "stripe_registration_ui_reader_missing"
      );
    }

    const values =
      ui.getRegistrationValues();

    return {
      email:
        requireString(
          values?.email,
          "missing_email"
        ),

      phone:
        requireString(
          values?.phone,
          "missing_phone"
        ),

      fullName:
        requireString(
          values?.fullName,
          "missing_full_name"
        ),

      country:
        TEST_COUNTRY
    };
  }


  /*
  --------------------------------------------------
  Register sandbox Link user
  --------------------------------------------------
  */

  async function registerLinkUser() {
    requireSandboxMode(
      "register_link_user_disabled_in_live_mode"
    );

    const sdk =
      await ensureSdk();

    if (
      typeof sdk.registerLinkUser !==
        "function"
    ) {
      throw new Error(
        "registerLinkUser_not_available"
      );
    }

    const userInfo =
      getRegistrationInfo();

    ui.setStatus(
      "Registering Link user..."
    );

    const result =
      await sdk.registerLinkUser(
        userInfo.email,
        userInfo.phone,
        userInfo.country
      );

    console.log(
      "STRIPE_REGISTER_LINK_USER",
      result
    );

    if (
      result?.created !==
        true
    ) {
      const error =
        new Error(
          "link_user_not_created"
        );

      error.payload =
        result ??
        null;

      throw error;
    }

    /*
    --------------------------------------------------
    A newly registered Link user starts a fresh Stripe
    customer/auth flow.

    Existing diagnostic settlement state is intentionally
    NOT touched here. That belongs to its own module.
    --------------------------------------------------
    */

    state.authIntentId =
      null;

    resetStripeCustomerState();

    ui.clearStripeContainer();

    ui.setStatus(
      "Link user created successfully.",
      result
    );

    return result;
  }


  /*
  --------------------------------------------------
  Create LinkAuthIntent
  --------------------------------------------------
  */

  async function createLinkAuthIntent() {
    if (
      typeof ui.getEmail !==
        "function"
    ) {
      throw new Error(
        "stripe_email_ui_reader_missing"
      );
    }

    const email =
      requireString(
        ui.getEmail(),
        "missing_email"
      );

    ui.setStatus(
      `Creating LinkAuthIntent (${state.browserConfig?.mode ?? "unknown"})...`
    );

    const response =
      await fetch(
        CREATE_LINK_AUTH_INTENT_URL,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              email
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
        `link_auth_intent_http_${response.status}`
      );
    }

    const createdAuthIntentId =
      requireString(
        payload?.authIntentId ??
        payload?.id,
        "missing_auth_intent_id"
      );

    /*
    --------------------------------------------------
    Reset customer-derived state first, then establish
    the new auth intent.

    resetStripeCustomerState() intentionally does not
    own authIntentId.
    --------------------------------------------------
    */

    resetStripeCustomerState();

    state.authIntentId =
      createdAuthIntentId;

    console.log(
      "STRIPE_LINK_AUTH_INTENT",
      {
        mode:
          state.browserConfig?.mode ??
          null,

        authIntentId:
          state.authIntentId
      }
    );

    ui.setStatus(
      "LinkAuthIntent created.",
      {
        mode:
          state.browserConfig?.mode ??
          null,

        authIntentId:
          state.authIntentId
      }
    );

    return state.authIntentId;
  }


  /*
  --------------------------------------------------
  Authenticate Link user

  The Stripe authentication callback may fire after
  authenticateLinkUser() itself has already returned the
  mounted element.

  Therefore state mutation for successful authentication
  lives inside the Stripe callback.

  A callback belongs ONLY to the auth intent that started
  it. If state.authIntentId has changed in the meantime,
  that callback is stale and must be ignored before any
  shared-state or UI mutation.

  onSuccess is optional and lets the orchestrator update
  button availability without moving Stripe callback logic
  into index.js.
  --------------------------------------------------
  */

  async function authenticateLinkUser({
    onSuccess = null
  } = {}) {
    const sdk =
      await ensureSdk();

    const normalizedAuthIntentId =
      requireString(
        state.authIntentId,
        "missing_auth_intent_id"
      );

    if (
      typeof sdk.authenticate !==
        "function"
    ) {
      throw new Error(
        "authenticate_not_available"
      );
    }

    resetStripeCustomerState();

    ui.clearStripeContainer();

    ui.setStatus(
      `Starting Link authentication (${state.browserConfig?.mode ?? "unknown"})...`
    );

    const authenticationElement =
      await sdk.authenticate(
        normalizedAuthIntentId,

        async (
          result
        ) => {
          /*
          --------------------------------------------------
          Stale-callback guard

          Another LinkAuthIntent may have been created while
          this Stripe element was still mounted.

          Never allow an older callback to mutate:

          - cryptoCustomerId
          - verification state
          - downstream limits/payment state
          - current diagnostic status

          The current authIntentId is the generation marker.
          --------------------------------------------------
          */

          if (
            normalizeString(
              state.authIntentId
            ) !==
              normalizedAuthIntentId
          ) {
            console.warn(
              "STRIPE_LINK_AUTH_STALE_RESULT_IGNORED",
              {
                authIntentId:
                  normalizedAuthIntentId,

                currentAuthIntentId:
                  normalizeOptionalString(
                    state.authIntentId
                  )
              }
            );

            return;
          }

          console.log(
            "STRIPE_LINK_AUTH_RESULT",
            result
          );

          if (
            result?.result ===
              "success"
          ) {
            const resolvedCryptoCustomerId =
              requireString(
                result
                  ?.crypto_customer_id,
                "missing_crypto_customer_id"
              );

            state.cryptoCustomerId =
              resolvedCryptoCustomerId;

            state.stripeKycVerified =
              false;

            state
              .stripeDocumentVerificationStatus =
              null;

            state.stripeDocumentVerified =
              false;

            resetLimitsState();

            ui.setStatus(
              "Link authentication successful.",
              {
                mode:
                  state.browserConfig?.mode ??
                  null,

                result:
                  result.result,

                authIntentId:
                  normalizedAuthIntentId,

                cryptoCustomerId:
                  state.cryptoCustomerId,

                liveSafetyGuard:
                  isLiveMode(),

                nextStep:
                  "Load CryptoCustomer to inspect basic KYC and L2 document-verification state."
              }
            );

            if (
              typeof onSuccess ===
                "function"
            ) {
              await onSuccess({
                authIntentId:
                  normalizedAuthIntentId,

                cryptoCustomerId:
                  state.cryptoCustomerId,

                result
              });
            }

            return;
          }

          if (
            result?.result ===
              "abandoned"
          ) {
            ui.setStatus(
              "Link authentication abandoned."
            );

            return;
          }

          if (
            result?.result ===
              "declined"
          ) {
            ui.setStatus(
              "Link OAuth consent declined."
            );

            return;
          }

          ui.setStatus(
            "Link authentication completed.",
            result
          );
        }
      );

    if (
      authenticationElement
    ) {
      ui.mountStripeElement(
        authenticationElement
      );
    }

    return authenticationElement;
  }


  /*
  --------------------------------------------------
  Load CryptoCustomer

  This request uses the Link OAuth binding represented by:

  authIntentId
  cryptoCustomerId

  It does not use the Clerk bearer token. Clerk belongs
  to UniBridge customer ownership / settlement routes.

  Every reload invalidates limits/payment-derived state
  because KYC state may have changed.
  --------------------------------------------------
  */

  async function loadCustomerContext() {
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

    ui.setStatus(
      `Loading CryptoCustomer (${state.browserConfig?.mode ?? "unknown"})...`
    );

    resetLimitsState();

    const response =
      await fetch(
        CUSTOMER_CONTEXT_URL,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
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
        `customer_context_http_${response.status}`
      );
    }

    state.stripeKycVerified =
      isKycVerified(
        payload
      );

    state
      .stripeDocumentVerificationStatus =
      getDocumentVerificationStatus(
        payload
      );

    state.stripeDocumentVerified =
      isDocumentVerified(
        payload
      );

    console.log(
      "STRIPE_CUSTOMER_CONTEXT",
      payload
    );

    console.log(
      "STRIPE_VERIFICATION_STATE",
      {
        kyc_verified:
          state.stripeKycVerified,

        id_document_verified:
          state
            .stripeDocumentVerificationStatus,

        l2_verified:
          Boolean(
            state.stripeKycVerified &&
            state.stripeDocumentVerified
          )
      }
    );

    /*
    --------------------------------------------------
    Keep this status intentionally limited to customer
    facts.

    Settlement/limits/button projections belong to the
    orchestrator because this module must not depend on
    diagnosticSettlement.js or stripeFunding.js.
    --------------------------------------------------
    */

    ui.setStatus(
      "CryptoCustomer loaded.",
      {
        mode:
          state.browserConfig?.mode ??
          null,

        ...payload,

        kycAlreadyVerified:
          state.stripeKycVerified,

        documentVerificationStatus:
          state
            .stripeDocumentVerificationStatus,

        l2Verified:
          Boolean(
            state.stripeKycVerified &&
            state.stripeDocumentVerified
          ),

        liveSafetyGuard:
          isLiveMode(),

        nextStep:
          !state.stripeKycVerified
            ? "Submit Stripe KYC, then reload CryptoCustomer."
            : !state.stripeDocumentVerified
              ? "Complete L2 document verification if available, then reload CryptoCustomer."
              : "Stripe L2 verification is complete. Continue to settlement-bound ACH transaction limits."
      }
    );

    return payload;
  }


  /*
  --------------------------------------------------
  Public contract
  --------------------------------------------------
  */

  return {
    /*
    Mode / SDK
    */

    loadBrowserConfig,
    ensureSdk,
    isSandboxMode,
    isLiveMode,

    /*
    Link / customer
    */

    registerLinkUser,
    createLinkAuthIntent,
    authenticateLinkUser,
    loadCustomerContext
  };
}
