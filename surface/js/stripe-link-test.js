// unibridge-landing/surface/js/stripe-link-test.js

(() => {
  /*
  --------------------------------------------------
  Stripe Embedded Components — Sandbox test only

  Flow:
  1. Load Stripe Embedded Components SDK
  2. Initialize with Sandbox publishable key
  3. registerLinkUser()
  4. Create LinkAuthIntent through UniBridge backend
  5. authenticate()
  6. Obtain crypto_customer_id

  IMPORTANT:
  - No Stripe secret key here
  - No OAuth client secret here
  --------------------------------------------------
  */

  const STRIPE_CRYPTO_MODULE =
    "https://cdn.jsdelivr.net/npm/@stripe/crypto@1.1.0/+esm";

  const STRIPE_PUBLISHABLE_KEY =
    "pk_test_51UDq2p40H0LwOW5qSK7K2sVIEupDU55gk1msz2MWS8KVmopPhxUdQZt1rjhbTJztE4jeYkpSo4I92SjpYH4BBqpZ00Ou2puiiq";

  const TEST_COUNTRY =
    "US";

  const CREATE_LINK_AUTH_INTENT_URL =
    "/api/stripe-onramp/embedded-components/link-auth-intent";

  let onramp = null;
  let sdkLoadPromise = null;
  let authIntentId = null;


  /* =========================
     DOM
  ========================= */

  const emailInput =
    document.getElementById(
      "email"
    );

  const phoneInput =
    document.getElementById(
      "phone"
    );

  const fullNameInput =
    document.getElementById(
      "full-name"
    );

  const registerButton =
    document.getElementById(
      "register-button"
    );

  const authIntentButton =
    document.getElementById(
      "auth-intent-button"
    );

  const authenticateButton =
    document.getElementById(
      "authenticate-button"
    );

  const statusElement =
    document.getElementById(
      "status"
    );

  const authContainer =
    document.getElementById(
      "auth-container"
    );


  /* =========================
     HELPERS
  ========================= */

  function setStatus(
    message,
    payload = null
  ) {
    const parts = [
      String(message || "")
    ];

    if (payload !== null) {
      try {
        parts.push(
          JSON.stringify(
            payload,
            null,
            2
          )
        );
      } catch {
        parts.push(
          String(payload)
        );
      }
    }

    statusElement.textContent =
      parts.join("\n\n");
  }


  function requireString(
    value,
    errorCode
  ) {
    const normalized =
      String(value ?? "")
        .trim();

    if (!normalized) {
      throw new Error(
        errorCode
      );
    }

    return normalized;
  }


  function getUserInfo() {
    return {
      email:
        requireString(
          emailInput.value,
          "missing_email"
        ),

      phone:
        requireString(
          phoneInput.value,
          "missing_phone"
        ),

      country:
        TEST_COUNTRY,

      fullName:
        requireString(
          fullNameInput.value,
          "missing_full_name"
        )
    };
  }


  function assertDom() {
    const missing = [];

    if (!emailInput) {
      missing.push(
        "email"
      );
    }

    if (!phoneInput) {
      missing.push(
        "phone"
      );
    }

    if (!fullNameInput) {
      missing.push(
        "full-name"
      );
    }

    if (!registerButton) {
      missing.push(
        "register-button"
      );
    }

    if (!authIntentButton) {
      missing.push(
        "auth-intent-button"
      );
    }

    if (!authenticateButton) {
      missing.push(
        "authenticate-button"
      );
    }

    if (!statusElement) {
      missing.push(
        "status"
      );
    }

    if (!authContainer) {
      missing.push(
        "auth-container"
      );
    }

    if (missing.length) {
      throw new Error(
        `missing_dom_elements:${missing.join(",")}`
      );
    }
  }


  /* =========================
     STRIPE SDK
  ========================= */

  async function ensureSdk() {
    if (onramp) {
      return onramp;
    }

    if (sdkLoadPromise) {
      return sdkLoadPromise;
    }

    sdkLoadPromise =
      import(
        STRIPE_CRYPTO_MODULE
      )
        .then(
          async (module) => {
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
                STRIPE_PUBLISHABLE_KEY,
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

            onramp =
              instance;

            return onramp;
          }
        )
        .catch(
          (error) => {
            sdkLoadPromise =
              null;

            onramp =
              null;

            throw error;
          }
        );

    return sdkLoadPromise;
  }


  /* =========================
     REGISTER LINK USER
  ========================= */

  async function registerLinkUser() {
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
      getUserInfo();

    setStatus(
      "Registering Link user..."
    );

    const result =
      await sdk.registerLinkUser(
        userInfo
      );

    console.log(
      "STRIPE_REGISTER_LINK_USER",
      result
    );

    setStatus(
      "Link registration completed.",
      result
    );

    return result;
  }


  /* =========================
     CREATE LINK AUTH INTENT
  ========================= */

  async function createLinkAuthIntent() {
    const email =
      requireString(
        emailInput.value,
        "missing_email"
      );

    setStatus(
      "Creating LinkAuthIntent..."
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
          () => null
        );

    if (!response.ok) {
      const error =
        new Error(
          payload?.error?.message ||
          payload?.message ||
          `link_auth_intent_http_${response.status}`
        );

      error.status =
        response.status;

      error.payload =
        payload;

      throw error;
    }

    authIntentId =
      requireString(
        payload?.authIntentId ??
        payload?.id,
        "missing_auth_intent_id"
      );

    authenticateButton.disabled =
      false;

    console.log(
      "STRIPE_LINK_AUTH_INTENT",
      {
        authIntentId
      }
    );

    setStatus(
      "LinkAuthIntent created.",
      {
        authIntentId
      }
    );

    return authIntentId;
  }


  /* =========================
     AUTHENTICATE
  ========================= */

  async function authenticateLinkUser() {
    const sdk =
      await ensureSdk();

    if (!authIntentId) {
      throw new Error(
        "missing_auth_intent_id"
      );
    }

    if (
      typeof sdk.authenticate !==
      "function"
    ) {
      throw new Error(
        "authenticate_not_available"
      );
    }

    setStatus(
      "Starting Link authentication..."
    );

    authContainer
      .replaceChildren();

    const authenticationElement =
      await sdk.authenticate(
        authIntentId,

        async (result) => {
          console.log(
            "STRIPE_LINK_AUTH_RESULT",
            result
          );

          if (
            result?.result ===
            "success"
          ) {
            setStatus(
              "Link authentication successful.",
              {
                result:
                  result.result,

                cryptoCustomerId:
                  result
                    .crypto_customer_id ??
                  null
              }
            );

            return;
          }

          if (
            result?.result ===
            "abandoned"
          ) {
            setStatus(
              "Link authentication abandoned."
            );

            return;
          }

          if (
            result?.result ===
            "declined"
          ) {
            setStatus(
              "Link OAuth consent declined."
            );

            return;
          }

          setStatus(
            "Link authentication completed.",
            result
          );
        }
      );

    if (
      authenticationElement
    ) {
      authContainer
        .replaceChildren(
          authenticationElement
        );
    }
  }


  /* =========================
     EVENTS
  ========================= */

  registerButton
    .addEventListener(
      "click",
      async () => {
        registerButton.disabled =
          true;

        try {
          await registerLinkUser();
        } catch (error) {
          console.error(
            "STRIPE_REGISTER_LINK_USER_FAILED",
            error
          );

          setStatus(
            "Link registration failed.",
            {
              message:
                error?.message ??
                String(error)
            }
          );
        } finally {
          registerButton.disabled =
            false;
        }
      }
    );


  authIntentButton
    .addEventListener(
      "click",
      async () => {
        authIntentButton.disabled =
          true;

        authenticateButton.disabled =
          true;

        authIntentId =
          null;

        try {
          await createLinkAuthIntent();
        } catch (error) {
          console.error(
            "STRIPE_CREATE_LINK_AUTH_INTENT_FAILED",
            error
          );

          setStatus(
            "LinkAuthIntent failed.",
            {
              status:
                error?.status ??
                null,

              message:
                error?.message ??
                String(error),

              payload:
                error?.payload ??
                null
            }
          );
        } finally {
          authIntentButton.disabled =
            false;
        }
      }
    );


  authenticateButton
    .addEventListener(
      "click",
      async () => {
        authenticateButton.disabled =
          true;

        try {
          await authenticateLinkUser();
        } catch (error) {
          console.error(
            "STRIPE_AUTHENTICATE_FAILED",
            error
          );

          setStatus(
            "Authentication failed.",
            {
              message:
                error?.message ??
                String(error)
            }
          );

          authenticateButton.disabled =
            false;
        }
      }
    );


  /* =========================
     INIT
  ========================= */

  try {
    assertDom();

    setStatus(
      "Loading Stripe Embedded Components SDK..."
    );

    ensureSdk()
      .then(
        () => {
          registerButton.disabled =
            false;

          authIntentButton.disabled =
            false;

          setStatus(
            "Stripe Embedded Components SDK initialized."
          );
        }
      )
      .catch(
        (error) => {
          console.error(
            "STRIPE_CRYPTO_INIT_FAILED",
            error
          );

          setStatus(
            "Stripe SDK initialization failed.",
            {
              message:
                error?.message ??
                String(error)
            }
          );
        }
      );
  } catch (error) {
    console.error(
      "STRIPE_LINK_TEST_BOOT_FAILED",
      error
    );

    if (statusElement) {
      setStatus(
        "Stripe Link test failed to boot.",
        {
          message:
            error?.message ??
            String(error)
        }
      );
    }
  }
})();
