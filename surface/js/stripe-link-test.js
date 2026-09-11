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
  7. Load CryptoCustomer through UniBridge backend
  8. Gate ACH using CryptoCustomer KYC verification state
  9. Submit KYC information through Web SDK if required
  10. Collect ACH payment method
  11. Obtain cryptoPaymentToken
  12. Test independent generic headless quote

  IMPORTANT:
  - No Stripe secret key here
  - No OAuth client secret here
  - No OAuth access token here
  - Web SDK uses submitKycInfo()
  - ACH collection is restricted to us_bank_account
  - Apple Pay and Google Pay are explicitly disabled
  - ACH is enabled only when Stripe reports kyc_verified
  --------------------------------------------------
  */

  const STRIPE_CRYPTO_MODULE =
    "https://cdn.jsdelivr.net/npm/@stripe/crypto@1.1.0/+esm";

  const STRIPE_PUBLISHABLE_KEY =
    "pk_test_51UDq2p40H0LwOW5qSK7K2sVIEupDU55gk1msz2MWS8KVmopPhxUdQZt1rjhbTJztE4jeYkpSo4I92SjpYH4BBqpZ00Ou2puiiq";

  const TEST_COUNTRY =
    "US";

  const CREATE_LINK_AUTH_INTENT_URL =
    "/v2/ramp/stripe/browser/link-auth-intent";

  const CUSTOMER_CONTEXT_URL =
    "/v2/ramp/stripe/browser/customer-context";

  const HEADLESS_QUOTE_URL =
    "/v2/ramp/stripe/browser/quote";

  let onramp =
    null;

  let sdkLoadPromise =
    null;

  let authIntentId =
    null;

  let cryptoCustomerId =
    null;

  let cryptoPaymentToken =
    null;


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

  const customerContextButton =
    document.getElementById(
      "customer-context-button"
    );

  const kycFirstNameInput =
    document.getElementById(
      "kyc-first-name"
    );

  const kycLastNameInput =
    document.getElementById(
      "kyc-last-name"
    );

  const kycIdNumberInput =
    document.getElementById(
      "kyc-id-number"
    );

  const kycDobInput =
    document.getElementById(
      "kyc-dob"
    );

  const kycAddressLine1Input =
    document.getElementById(
      "kyc-address-line1"
    );

  const kycCityInput =
    document.getElementById(
      "kyc-city"
    );

  const kycStateInput =
    document.getElementById(
      "kyc-state"
    );

  const kycPostalCodeInput =
    document.getElementById(
      "kyc-postal-code"
    );

  const kycButton =
    document.getElementById(
      "kyc-button"
    );

  const achButton =
    document.getElementById(
      "ach-button"
    );

  const quoteAmountInput =
    document.getElementById(
      "quote-amount"
    );

  const quoteCurrencyInput =
    document.getElementById(
      "quote-currency"
    );

  const quoteButton =
    document.getElementById(
      "quote-button"
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
      String(
        message || ""
      )
    ];

    if (
      payload !==
      null
    ) {
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
          String(
            payload
          )
        );
      }
    }

    statusElement.textContent =
      parts.join(
        "\n\n"
      );
  }


  function requireString(
    value,
    errorCode
  ) {
    const normalized =
      String(
        value ?? ""
      )
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


  function buildKycInfo() {
    const dob =
      requireString(
        kycDobInput.value,
        "missing_kyc_dob"
      );

    const [
      year,
      month,
      day
    ] =
      dob
        .split("-")
        .map(
          (value) =>
            Number(
              value
            )
        );

    if (
      !Number.isInteger(
        year
      ) ||
      !Number.isInteger(
        month
      ) ||
      !Number.isInteger(
        day
      ) ||
      year <= 0 ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      throw new Error(
        "invalid_kyc_dob"
      );
    }

    const ssn =
      requireString(
        kycIdNumberInput.value,
        "missing_kyc_id_number"
      )
        .replace(
          /\D/g,
          ""
        );

    if (
      ssn.length !==
      9
    ) {
      throw new Error(
        "invalid_kyc_us_ssn"
      );
    }

    return {
      given_name:
        requireString(
          kycFirstNameInput.value,
          "missing_kyc_first_name"
        ),

      surname:
        requireString(
          kycLastNameInput.value,
          "missing_kyc_last_name"
        ),

      address: {
        line1:
          requireString(
            kycAddressLine1Input.value,
            "missing_kyc_address_line1"
          ),

        city:
          requireString(
            kycCityInput.value,
            "missing_kyc_city"
          ),

        state:
          requireString(
            kycStateInput.value,
            "missing_kyc_state"
          ),

        postal_code:
          requireString(
            kycPostalCodeInput.value,
            "missing_kyc_postal_code"
          ),

        country:
          TEST_COUNTRY
      },

      date_of_birth: {
        year,
        month,
        day
      },

      id_number: {
        type:
          "us_ssn",

        value:
          ssn
      }
    };
  }


  function isKycVerified(
    payload
  ) {
    const verifications =
      Array.isArray(
        payload?.verifications
      )
        ? payload.verifications
        : [];

    const kycVerification =
      verifications.find(
        (item) =>
          String(
            item?.name ?? ""
          )
            .trim()
            .toLowerCase() ===
          "kyc_verified"
      );

    const status =
      String(
        kycVerification?.status ??
        ""
      )
        .trim()
        .toLowerCase();

    return status ===
      "verified";
  }


  function assertDom() {
    const missing =
      [];

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

    if (!customerContextButton) {
      missing.push(
        "customer-context-button"
      );
    }

    if (!kycFirstNameInput) {
      missing.push(
        "kyc-first-name"
      );
    }

    if (!kycLastNameInput) {
      missing.push(
        "kyc-last-name"
      );
    }

    if (!kycIdNumberInput) {
      missing.push(
        "kyc-id-number"
      );
    }

    if (!kycDobInput) {
      missing.push(
        "kyc-dob"
      );
    }

    if (!kycAddressLine1Input) {
      missing.push(
        "kyc-address-line1"
      );
    }

    if (!kycCityInput) {
      missing.push(
        "kyc-city"
      );
    }

    if (!kycStateInput) {
      missing.push(
        "kyc-state"
      );
    }

    if (!kycPostalCodeInput) {
      missing.push(
        "kyc-postal-code"
      );
    }

    if (!kycButton) {
      missing.push(
        "kyc-button"
      );
    }

    if (!achButton) {
      missing.push(
        "ach-button"
      );
    }

    if (!quoteAmountInput) {
      missing.push(
        "quote-amount"
      );
    }

    if (!quoteCurrencyInput) {
      missing.push(
        "quote-currency"
      );
    }

    if (!quoteButton) {
      missing.push(
        "quote-button"
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

    if (
      missing.length
    ) {
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

    if (
      sdkLoadPromise
    ) {
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

    authIntentId =
      null;

    cryptoCustomerId =
      null;

    cryptoPaymentToken =
      null;

    authenticateButton.disabled =
      true;

    customerContextButton.disabled =
      true;

    kycButton.disabled =
      true;

    achButton.disabled =
      true;

    authContainer
      .replaceChildren();

    setStatus(
      "Link user created successfully.",
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
          () =>
            null
        );

    if (
      !response.ok
    ) {
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

    cryptoCustomerId =
      null;

    cryptoPaymentToken =
      null;

    authenticateButton.disabled =
      false;

    customerContextButton.disabled =
      true;

    kycButton.disabled =
      true;

    achButton.disabled =
      true;

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

    const normalizedAuthIntentId =
      requireString(
        authIntentId,
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

    setStatus(
      "Starting Link authentication..."
    );

    cryptoCustomerId =
      null;

    cryptoPaymentToken =
      null;

    customerContextButton.disabled =
      true;

    kycButton.disabled =
      true;

    achButton.disabled =
      true;

    authContainer
      .replaceChildren();

    const authenticationElement =
      await sdk.authenticate(
        normalizedAuthIntentId,

        async (result) => {
          console.log(
            "STRIPE_LINK_AUTH_RESULT",
            result
          );

          if (
            result?.result ===
            "success"
          ) {
            cryptoCustomerId =
              requireString(
                result
                  ?.crypto_customer_id,
                "missing_crypto_customer_id"
              );

            customerContextButton.disabled =
              false;

            kycButton.disabled =
              false;

            achButton.disabled =
              true;

            setStatus(
              "Link authentication successful.",
              {
                result:
                  result.result,

                authIntentId:
                  normalizedAuthIntentId,

                cryptoCustomerId,

                nextStep:
                  "Load CryptoCustomer to verify KYC before ACH collection."
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
     LOAD CRYPTO CUSTOMER
  ========================= */

  async function loadCustomerContext() {
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

    setStatus(
      "Loading CryptoCustomer..."
    );

    achButton.disabled =
      true;

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
      const error =
        new Error(
          payload?.error?.message ||
          payload?.message ||
          `customer_context_http_${response.status}`
        );

      error.status =
        response.status;

      error.payload =
        payload;

      throw error;
    }

    const kycVerified =
      isKycVerified(
        payload
      );

    achButton.disabled =
      !kycVerified;

    console.log(
      "STRIPE_CUSTOMER_CONTEXT",
      payload
    );

    console.log(
      "STRIPE_KYC_VERIFIED",
      kycVerified
    );

    setStatus(
      "CryptoCustomer loaded.",
      {
        ...payload,

        achCollectionEnabled:
          kycVerified
      }
    );

    return payload;
  }


  /* =========================
     SUBMIT KYC — WEB SDK
  ========================= */

  async function submitStripeKyc() {
    const sdk =
      await ensureSdk();

    requireString(
      cryptoCustomerId,
      "missing_crypto_customer_id"
    );

    if (
      typeof sdk.submitKycInfo !==
      "function"
    ) {
      throw new Error(
        "submitKycInfo_not_available"
      );
    }

    const kycInfo =
      buildKycInfo();

    setStatus(
      "Submitting Stripe KYC..."
    );

    achButton.disabled =
      true;

    console.log(
      "STRIPE_KYC_INFO",
      {
        ...kycInfo,

        id_number: {
          type:
            kycInfo.id_number.type,

          value:
            "[REDACTED]"
        }
      }
    );

    const result =
      await sdk.submitKycInfo(
        kycInfo
      );

    console.log(
      "STRIPE_SUBMIT_KYC_RESULT",
      result
    );

    return result;
  }


  /* =========================
     COLLECT ACH PAYMENT METHOD
  ========================= */

  async function collectAchPaymentMethod() {
    const sdk =
      await ensureSdk();

    requireString(
      cryptoCustomerId,
      "missing_crypto_customer_id"
    );

    if (
      typeof sdk.collectPaymentMethod !==
      "function"
    ) {
      throw new Error(
        "collectPaymentMethod_not_available"
      );
    }

    cryptoPaymentToken =
      null;

    setStatus(
      "Collecting ACH payment method..."
    );

    authContainer
      .replaceChildren();

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

        (result) => {
          console.log(
            "STRIPE_PAYMENT_METHOD_RESULT",
            result
          );

          const token =
            result?.cryptoPaymentToken ??
            result?.crypto_payment_token ??
            null;

          if (token) {
            cryptoPaymentToken =
              token;

            setStatus(
              "ACH payment method collected.",
              {
                cryptoPaymentToken
              }
            );

            return;
          }

          if (
            result?.result ===
            "abandoned"
          ) {
            setStatus(
              "ACH payment-method collection abandoned.",
              result
            );

            achButton.disabled =
              false;

            return;
          }

          if (
            result?.error
          ) {
            setStatus(
              "ACH payment-method collection failed.",
              result
            );

            achButton.disabled =
              false;

            return;
          }

          setStatus(
            "ACH payment-method callback received.",
            result
          );
        }
      );

    if (
      paymentElement
    ) {
      authContainer
        .replaceChildren(
          paymentElement
        );
    }
  }


  /* =========================
     HEADLESS QUOTE
  ========================= */

  async function loadHeadlessQuote() {
    const sourceAmount =
      requireString(
        quoteAmountInput.value,
        "missing_quote_amount"
      );

    const sourceCurrency =
      requireString(
        quoteCurrencyInput.value,
        "missing_quote_currency"
      )
        .toLowerCase();

    setStatus(
      "Loading Stripe generic headless quote..."
    );

    const response =
      await fetch(
        HEADLESS_QUOTE_URL,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              sourceAmount,
              sourceCurrency
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
      const error =
        new Error(
          payload?.error?.message ||
          payload?.message ||
          `headless_quote_http_${response.status}`
        );

      error.status =
        response.status;

      error.payload =
        payload;

      throw error;
    }

    console.log(
      "STRIPE_HEADLESS_QUOTE",
      payload
    );

    setStatus(
      "Stripe generic headless quote loaded.",
      payload
    );

    return payload;
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
                String(
                  error
                ),

              payload:
                error?.payload ??
                null
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

        customerContextButton.disabled =
          true;

        kycButton.disabled =
          true;

        achButton.disabled =
          true;

        authIntentId =
          null;

        cryptoCustomerId =
          null;

        cryptoPaymentToken =
          null;

        authContainer
          .replaceChildren();

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
                String(
                  error
                ),

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

        customerContextButton.disabled =
          true;

        kycButton.disabled =
          true;

        achButton.disabled =
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
                String(
                  error
                )
            }
          );

          authenticateButton.disabled =
            false;
        }
      }
    );


  customerContextButton
    .addEventListener(
      "click",
      async () => {
        customerContextButton.disabled =
          true;

        achButton.disabled =
          true;

        try {
          await loadCustomerContext();
        } catch (error) {
          console.error(
            "STRIPE_CUSTOMER_CONTEXT_FAILED",
            error
          );

          setStatus(
            "CryptoCustomer load failed.",
            {
              status:
                error?.status ??
                null,

              message:
                error?.message ??
                String(
                  error
                ),

              payload:
                error?.payload ??
                null
            }
          );

          achButton.disabled =
            true;
        } finally {
          customerContextButton.disabled =
            false;
        }
      }
    );


  kycButton
    .addEventListener(
      "click",
      async () => {
        kycButton.disabled =
          true;

        customerContextButton.disabled =
          true;

        achButton.disabled =
          true;

        try {
          const kycResult =
            await submitStripeKyc();

          console.log(
            "STRIPE_SUBMIT_KYC_COMPLETE",
            kycResult
          );

          setStatus(
            "Stripe KYC submitted.",
            {
              kycResult:
                kycResult ??
                null,

              nextStep:
                "Load CryptoCustomer again before enabling ACH."
            }
          );
        } catch (error) {
          console.error(
            "STRIPE_SUBMIT_KYC_FAILED",
            error
          );

          setStatus(
            "Stripe KYC failed.",
            {
              status:
                error?.status ??
                null,

              message:
                error?.message ??
                String(
                  error
                ),

              payload:
                error?.payload ??
                null
            }
          );
        } finally {
          kycButton.disabled =
            false;

          customerContextButton.disabled =
            false;

          achButton.disabled =
            true;
        }
      }
    );


  achButton
    .addEventListener(
      "click",
      async () => {
        achButton.disabled =
          true;

        try {
          await collectAchPaymentMethod();
        } catch (error) {
          console.error(
            "STRIPE_COLLECT_ACH_FAILED",
            error
          );

          setStatus(
            "ACH payment-method collection failed.",
            {
              message:
                error?.message ??
                String(
                  error
                ),

              payload:
                error?.payload ??
                null
            }
          );

          achButton.disabled =
            false;
        }
      }
    );


  quoteButton
    .addEventListener(
      "click",
      async () => {
        quoteButton.disabled =
          true;

        try {
          await loadHeadlessQuote();
        } catch (error) {
          console.error(
            "STRIPE_HEADLESS_QUOTE_FAILED",
            error
          );

          setStatus(
            "Stripe generic headless quote failed.",
            {
              status:
                error?.status ??
                null,

              message:
                error?.message ??
                String(
                  error
                ),

              payload:
                error?.payload ??
                null
            }
          );
        } finally {
          quoteButton.disabled =
            false;
        }
      }
    );


  /* =========================
     INIT
  ========================= */

  try {
    assertDom();

    registerButton.disabled =
      true;

    authIntentButton.disabled =
      true;

    authenticateButton.disabled =
      true;

    customerContextButton.disabled =
      true;

    kycButton.disabled =
      true;

    achButton.disabled =
      true;

    quoteButton.disabled =
      true;

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

          authenticateButton.disabled =
            true;

          customerContextButton.disabled =
            true;

          kycButton.disabled =
            true;

          achButton.disabled =
            true;

          quoteButton.disabled =
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
                String(
                  error
                )
            }
          );
        }
      );
  } catch (error) {
    console.error(
      "STRIPE_LINK_TEST_BOOT_FAILED",
      error
    );

    if (
      statusElement
    ) {
      setStatus(
        "Stripe Link test failed to boot.",
        {
          message:
            error?.message ??
            String(
              error
            )
        }
      );
    }
  }
})();
