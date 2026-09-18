// unibrij/unibridge-landing/surface/js/ramp/stripeEmbedded/stripeRuntime.js

const STRIPE_CRYPTO_MODULE =
  "https://cdn.jsdelivr.net/npm/@stripe/crypto@1.1.0/+esm";

const STRIPE_BROWSER_CONFIG_URL =
  "/v2/ramp/stripe/browser/config";


let browserConfig = null;
let browserConfigPromise = null;

let sdk = null;
let sdkPromise = null;


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
Browser configuration

Loaded once and cached in memory.

Only browser-safe Stripe configuration crosses this
boundary.

Expected response:

{
  mode,
  isSandbox,
  publishableKey
}
--------------------------------------------------
*/

async function loadBrowserConfig() {
  if (browserConfig) {
    return browserConfig;
  }

  if (browserConfigPromise) {
    return browserConfigPromise;
  }

  browserConfigPromise =
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

          if (!response.ok) {
            throw new Error(
              payload?.error?.message ||
              payload?.message ||
              `stripe_browser_config_http_${response.status}`
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

          browserConfig = {
            mode:
              normalizeString(
                payload?.mode
              ) ||
              null,

            isSandbox:
              typeof payload?.isSandbox ===
                "boolean"
                ? payload.isSandbox
                : null,

            publishableKey
          };

          return browserConfig;
        }
      )
      .catch(
        (
          error
        ) => {
          browserConfigPromise =
            null;

          browserConfig =
            null;

          throw error;
        }
      );

  return browserConfigPromise;
}


/*
--------------------------------------------------
Stripe browser runtime

The Stripe Crypto SDK is initialized once per page.

Concurrent callers share the same initialization
promise.

If initialization fails, the cached promise and SDK
are cleared so a later attempt may retry.
--------------------------------------------------
*/

export async function ensureStripeSdk() {
  if (sdk) {
    return sdk;
  }

  if (sdkPromise) {
    return sdkPromise;
  }

  sdkPromise =
    (
      async () => {
        const config =
          await loadBrowserConfig();

        const module =
          await import(
            STRIPE_CRYPTO_MODULE
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

        sdk =
          instance;

        return sdk;
      }
    )()
      .catch(
        (
          error
        ) => {
          sdkPromise =
            null;

          sdk =
            null;

          throw error;
        }
      );

  return sdkPromise;
}
