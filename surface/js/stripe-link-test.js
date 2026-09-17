// unibridge-landing/surface/js/stripe-link-test.js

(() => {
  /*
  --------------------------------------------------
  Stripe Embedded Components — Diagnostic test page

  Backend mode is the single source of truth:

  STRIPE_ONRAMP_MODE=sandbox
  → Sandbox credentials
  → Full diagnostic flow enabled
  → A clean US diagnostic settlement is created
    automatically when ACH limits are requested.

  STRIPE_ONRAMP_MODE=live
  → Live credentials
  → SAFE DIAGNOSTIC ONLY:
      * Create LinkAuthIntent
      * Authenticate
      * Load CryptoCustomer
      * Load settlement-bound transaction limits
        only for an already-L2-verified customer

  Sandbox flow:

  1. Load browser config
  2. Initialize Stripe SDK
  3. Register Link user if needed
  4. Create LinkAuthIntent
  5. Authenticate
  6. Load CryptoCustomer
  7. Submit basic Stripe KYC if required
  8. Reload CryptoCustomer
  9. Complete L2 document verification if required
     (photo ID + selfie)
  10. Reload CryptoCustomer
  11. Create clean US sandbox diagnostic settlement
      owned by the current Clerk customer
  12. Load settlement-bound ACH transaction limits
  13. Collect ACH payment method
  14. Obtain cryptoPaymentToken
  15. Create settlement-bound Headless Session
  16. Inspect session transaction details / quote
  17. performCheckout() using the same session

  IMPORTANT:
  - No Stripe secret key here
  - No OAuth client secret here
  - No OAuth access token here
  - Publishable key comes from backend config
  - Backend STRIPE_ONRAMP_MODE is source of truth
  - ACH collection is restricted to us_bank_account
  - Apple Pay and Google Pay are disabled
  - ACH requires Stripe L2:
      kyc_verified = verified
      id_document_verified = verified
  - Limits must pass before ACH collection
  - Canonical amount comes from settlement backend state
  - Canonical wallet comes from settlement backend state
  - Canonical network comes from settlement backend state
  - Canonical currencies come from settlement backend state
  - Headless Session transaction details are the quote
  - There is no separate generic production quote request
  - cryptoPaymentToken is never displayed or logged
  - client_secret is never displayed or logged
  - Clerk bearer token is never displayed or logged

  LIVE mode cannot:
      * register Link users
      * submit KYC
      * perform document verification
      * collect ACH
      * create headless sessions
      * perform checkout

  Sandbox:
  - settlementId in the URL is intentionally ignored.
  - The test settlement is created server-side on demand.

  Live diagnostic:
  /surface/stripe-link-test.html?settlementId=<SETTLEMENT_ID>

  or:

  /surface/stripe-link-test.html?settlement_id=<SETTLEMENT_ID>
  --------------------------------------------------
  */

  const STRIPE_CRYPTO_MODULE =
    "https://cdn.jsdelivr.net/npm/@stripe/crypto@1.1.0/+esm";

  const STRIPE_BROWSER_CONFIG_URL =
    "/v2/ramp/stripe/browser/config";

  const TEST_COUNTRY =
    "US";

  const CREATE_LINK_AUTH_INTENT_URL =
    "/v2/ramp/stripe/browser/link-auth-intent";

  const CUSTOMER_CONTEXT_URL =
    "/v2/ramp/stripe/browser/customer-context";

  const SANDBOX_TEST_SETTLEMENT_URL =
    "/v2/ramp/stripe/browser/test-settlement";

  const TRANSACTION_LIMITS_URL =
    "/v2/ramp/stripe/browser/transaction-limits";

  const HEADLESS_SESSION_URL =
    "/v2/ramp/stripe/browser/headless-session";


  let browserConfig =
    null;

  let browserConfigLoadPromise =
    null;

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

  let stripeKycVerified =
    false;

  let stripeDocumentVerificationStatus =
    null;

  let stripeDocumentVerified =
    false;

  let achLimitsAvailable =
    false;

  let transactionLimits =
    null;

  let headlessSession =
    null;

  let checkoutCompleted =
    false;

  /*
  --------------------------------------------------
  Sandbox diagnostic settlement state

  This is NEVER initialized from the URL in sandbox.

  It must come from:
  POST /v2/ramp/stripe/browser/test-settlement
  --------------------------------------------------
  */

  let sandboxDiagnosticSettlementId =
    null;

  let sandboxDiagnosticSettlementPromise =
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

  const transactionLimitsButton =
    document.getElementById(
      "transaction-limits-button"
    );

  const headlessSessionButton =
    document.getElementById(
      "headless-session-button"
    );

  /*
  --------------------------------------------------
  Legacy diagnostic inputs.

  They remain optional because the existing HTML may
  still contain them.

  They are no longer authoritative.
  --------------------------------------------------
  */

  const sessionAmountInput =
    document.getElementById(
      "session-amount"
    );

  const sessionCurrencyInput =
    document.getElementById(
      "session-currency"
    );

  const walletAddressInput =
    document.getElementById(
      "wallet-address"
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


  function isSandboxMode() {
    return Boolean(
      browserConfig?.mode ===
        "sandbox" &&
      browserConfig?.isSandbox ===
        true
    );
  }


  function isLiveMode() {
    return Boolean(
      browserConfig?.mode ===
        "live" &&
      browserConfig?.isSandbox ===
        false
    );
  }


  function requireSandboxMode(
    errorCode =
      "sandbox_only_action"
  ) {
    if (
      !isSandboxMode()
    ) {
      throw new Error(
        errorCode
      );
    }
  }


  /*
  --------------------------------------------------
  URL settlement

  Used only by LIVE safe diagnostic mode.

  Sandbox intentionally does not trust/use this value.
  --------------------------------------------------
  */

  function resolveUrlDiagnosticSettlementId() {
    const params =
      new URLSearchParams(
        window.location.search
      );

    return (
      normalizeString(
        params.get(
          "settlementId"
        )
      ) ||
      normalizeString(
        params.get(
          "settlement_id"
        )
      ) ||
      null
    );
  }


  /*
  --------------------------------------------------
  Active diagnostic settlement

  Sandbox:
  → only the server-created test settlement

  Live:
  → explicit URL settlement
  --------------------------------------------------
  */

  function resolveDiagnosticSettlementId() {
    if (
      isSandboxMode()
    ) {
      return (
        sandboxDiagnosticSettlementId ||
        null
      );
    }

    return resolveUrlDiagnosticSettlementId();
  }


  function requireDiagnosticSettlementId() {
    return requireString(
      resolveDiagnosticSettlementId(),
      "missing_diagnostic_settlement_id"
    );
  }


  function rememberSandboxDiagnosticSettlementId(
    settlementId
  ) {
    const normalizedSettlementId =
      requireString(
        settlementId,
        "missing_sandbox_diagnostic_settlement_id"
      );

    sandboxDiagnosticSettlementId =
      normalizedSettlementId;

    /*
    --------------------------------------------------
    Reflect the generated ID in the URL for visibility
    and copy/paste debugging.

    On a fresh page load in sandbox this URL value is
    still ignored; a new authenticated diagnostic
    settlement will be created on demand.
    --------------------------------------------------
    */

    try {
      const url =
        new URL(
          window.location.href
        );

      url.searchParams.set(
        "settlementId",
        normalizedSettlementId
      );

      url.searchParams.delete(
        "settlement_id"
      );

      window.history.replaceState(
        window.history.state,
        "",
        url
      );
    } catch (
      error
    ) {
      console.warn(
        "STRIPE_SANDBOX_SETTLEMENT_URL_UPDATE_FAILED",
        {
          message:
            error?.message ??
            String(
              error
            )
        }
      );
    }

    return normalizedSettlementId;
  }


  async function getClerkBearerToken() {
    const clerk =
      window.Clerk;

    if (!clerk) {
      throw new Error(
        "clerk_not_available"
      );
    }

    const session =
      clerk.session;

    if (!session) {
      throw new Error(
        "clerk_session_not_available"
      );
    }

    if (
      typeof session.getToken !==
        "function"
    ) {
      throw new Error(
        "clerk_get_token_not_available"
      );
    }

    const token =
      await session.getToken();

    return requireString(
      token,
      "missing_clerk_bearer_token"
    );
  }


  async function buildAuthenticatedJsonHeaders() {
    const token =
      await getClerkBearerToken();

    return {
      "Content-Type":
        "application/json",

      Accept:
        "application/json",

      Authorization:
        `Bearer ${token}`
    };
  }


  function getVerificationStatus(
    payload,
    verificationName
  ) {
    const normalizedName =
      normalizeString(
        verificationName
      )
        .toLowerCase();

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


  function canStartDocumentVerification() {
    return Boolean(
      isSandboxMode() &&
      cryptoCustomerId &&
      stripeKycVerified &&
      !stripeDocumentVerified &&
      stripeDocumentVerificationStatus ===
        "not_started"
    );
  }


  function canLoadTransactionLimits() {
    const settlementCanBeResolved =
      isSandboxMode() ||
      Boolean(
        resolveDiagnosticSettlementId()
      );

    return Boolean(
      authIntentId &&
      cryptoCustomerId &&
      stripeKycVerified &&
      stripeDocumentVerified &&
      settlementCanBeResolved
    );
  }


  function canCollectAch() {
    return Boolean(
      isSandboxMode() &&
      stripeKycVerified &&
      stripeDocumentVerified &&
      achLimitsAvailable
    );
  }


  function canCreateHeadlessSession() {
    return Boolean(
      isSandboxMode() &&
      stripeKycVerified &&
      stripeDocumentVerified &&
      achLimitsAvailable &&
      cryptoPaymentToken &&
      sandboxDiagnosticSettlementId
    );
  }


  function canPerformCheckout() {
    return Boolean(
      isSandboxMode() &&
      headlessSession?.sessionId &&
      headlessSession?.clientSecret &&
      checkoutCompleted !==
        true
    );
  }


  function syncKycActionButton() {
    if (
      !cryptoCustomerId
    ) {
      kycButton.disabled =
        true;

      kycButton.textContent =
        "Submit Stripe KYC";

      return;
    }

    if (
      !stripeKycVerified
    ) {
      kycButton.textContent =
        "Submit Stripe KYC";

      kycButton.disabled =
        !isSandboxMode();

      return;
    }

    if (
      stripeDocumentVerified
    ) {
      kycButton.textContent =
        "L2 Verification Complete";

      kycButton.disabled =
        true;

      return;
    }

    if (
      canStartDocumentVerification()
    ) {
      kycButton.textContent =
        "Complete L2 Document Verification";

      kycButton.disabled =
        false;

      return;
    }

    if (
      stripeDocumentVerificationStatus
    ) {
      kycButton.textContent =
        `L2 Document Verification: ${stripeDocumentVerificationStatus}`;
    } else {
      kycButton.textContent =
        "L2 Document Verification";
    }

    kycButton.disabled =
      true;
  }


  function syncTransactionLimitsButton() {
    transactionLimitsButton.disabled =
      !canLoadTransactionLimits();
  }


  function syncAchButton() {
    achButton.disabled =
      !canCollectAch();
  }


  function syncHeadlessSessionButton() {
    headlessSessionButton.disabled =
      !canCreateHeadlessSession();
  }


  function syncCheckoutButton() {
    quoteButton.disabled =
      !canPerformCheckout();
  }


  function syncFlowButtons() {
    syncTransactionLimitsButton();
    syncAchButton();
    syncHeadlessSessionButton();
    syncCheckoutButton();
  }


  function resetCheckoutState() {
    headlessSession =
      null;

    checkoutCompleted =
      false;

    syncCheckoutButton();
  }


  function resetPaymentMethodState() {
    cryptoPaymentToken =
      null;

    resetCheckoutState();

    syncHeadlessSessionButton();
  }


  function resetLimitsState() {
    achLimitsAvailable =
      false;

    transactionLimits =
      null;

    resetPaymentMethodState();

    syncAchButton();
    syncTransactionLimitsButton();
  }


  function resetStripeCustomerState() {
    cryptoCustomerId =
      null;

    stripeKycVerified =
      false;

    stripeDocumentVerificationStatus =
      null;

    stripeDocumentVerified =
      false;

    resetLimitsState();

    syncKycActionButton();
    syncFlowButtons();
  }


  function getCustomerNextStep() {
    if (
      !stripeKycVerified
    ) {
      return (
        "Submit Stripe KYC, then reload CryptoCustomer."
      );
    }

    if (
      !stripeDocumentVerified
    ) {
      if (
        stripeDocumentVerificationStatus ===
          "not_started"
      ) {
        return (
          isSandboxMode()
            ? "Complete L2 Document Verification (photo ID + selfie), then reload CryptoCustomer."
            : "L2 document verification is required before ACH transaction limits."
        );
      }

      if (
        stripeDocumentVerificationStatus ===
          "pending"
      ) {
        return (
          "L2 document verification is pending. Reload CryptoCustomer after Stripe completes verification."
        );
      }

      return (
        `L2 document verification is not verified${
          stripeDocumentVerificationStatus
            ? ` (${stripeDocumentVerificationStatus})`
            : ""
        }.`
      );
    }

    if (
      isSandboxMode()
    ) {
      if (
        sandboxDiagnosticSettlementId
      ) {
        return (
          "Get ACH Transaction Limits using the generated sandbox diagnostic settlement."
        );
      }

      return (
        "Get ACH Transaction Limits. A clean US sandbox diagnostic settlement will be created automatically first."
      );
    }

    if (
      !resolveDiagnosticSettlementId()
    ) {
      return (
        "Add ?settlementId=<SETTLEMENT_ID> to the diagnostic URL, then get ACH Transaction Limits."
      );
    }

    return (
      "Get ACH Transaction Limits."
    );
  }


  function configureCurrentDiagnosticUi() {
    transactionLimitsButton.textContent =
      "8. Get ACH Transaction Limits";

    headlessSessionButton.textContent =
      "10. Create ACH Headless Session + Quote";

    quoteButton.textContent =
      "11. Perform Checkout";

    const legacyInputs = [
      sessionAmountInput,
      sessionCurrencyInput,
      walletAddressInput,
      quoteAmountInput,
      quoteCurrencyInput
    ];

    for (
      const input
      of legacyInputs
    ) {
      if (!input) {
        continue;
      }

      input.disabled =
        true;

      input.title =
        "Legacy diagnostic field. Current flow resolves this value from the settlement backend state.";
    }
  }


  function assertDom() {
    const missing =
      [];

    const requiredElements = [
      [emailInput, "email"],
      [phoneInput, "phone"],
      [fullNameInput, "full-name"],
      [registerButton, "register-button"],
      [authIntentButton, "auth-intent-button"],
      [authenticateButton, "authenticate-button"],
      [customerContextButton, "customer-context-button"],
      [kycFirstNameInput, "kyc-first-name"],
      [kycLastNameInput, "kyc-last-name"],
      [kycIdNumberInput, "kyc-id-number"],
      [kycDobInput, "kyc-dob"],
      [kycAddressLine1Input, "kyc-address-line1"],
      [kycCityInput, "kyc-city"],
      [kycStateInput, "kyc-state"],
      [kycPostalCodeInput, "kyc-postal-code"],
      [kycButton, "kyc-button"],
      [achButton, "ach-button"],
      [
        transactionLimitsButton,
        "transaction-limits-button"
      ],
      [
        headlessSessionButton,
        "headless-session-button"
      ],
      [quoteButton, "quote-button"],
      [statusElement, "status"],
      [authContainer, "auth-container"]
    ];

    for (
      const [
        element,
        name
      ]
      of requiredElements
    ) {
      if (!element) {
        missing.push(
          name
        );
      }
    }

    if (
      missing.length
    ) {
      throw new Error(
        `missing_dom_elements:${missing.join(",")}`
      );
    }
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
          (
            value
          ) =>
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


  /* =========================
     BROWSER CONFIG
  ========================= */

  async function loadBrowserConfig() {
    if (
      browserConfig
    ) {
      return browserConfig;
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
              const error =
                new Error(
                  payload?.error?.message ||
                  payload?.message ||
                  `stripe_browser_config_http_${response.status}`
                );

              error.status =
                response.status;

              error.payload =
                payload;

              throw error;
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

            browserConfig = {
              mode,
              isSandbox,
              publishableKey
            };

            console.log(
              "STRIPE_BROWSER_CONFIG",
              {
                mode:
                  browserConfig.mode,

                isSandbox:
                  browserConfig.isSandbox,

                publishableKeyType:
                  browserConfig.publishableKey
                    .startsWith(
                      "pk_live_"
                    )
                    ? "live"
                    : "test"
              }
            );

            return browserConfig;
          }
        )
        .catch(
          (
            error
          ) => {
            browserConfigLoadPromise =
              null;

            browserConfig =
              null;

            throw error;
          }
        );

    return browserConfigLoadPromise;
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

          onramp =
            instance;

          return onramp;
        }
      )()
        .catch(
          (
            error
          ) => {
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
     SANDBOX DIAGNOSTIC
     SETTLEMENT
  ========================= */

  async function createSandboxDiagnosticSettlement() {
    requireSandboxMode(
      "sandbox_test_settlement_disabled_in_live_mode"
    );

    const headers =
      await buildAuthenticatedJsonHeaders();

    setStatus(
      "Creating clean US sandbox diagnostic settlement...",
      {
        mode:
          browserConfig?.mode ??
          null,

        authenticated:
          true
      }
    );

    const response =
      await fetch(
        SANDBOX_TEST_SETTLEMENT_URL,
        {
          method:
            "POST",

          headers,

          body:
            JSON.stringify({})
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
          `sandbox_test_settlement_http_${response.status}`
        );

      error.status =
        response.status;

      error.payload =
        payload;

      throw error;
    }

    if (
      payload?.ok !==
        true
    ) {
      throw new Error(
        "sandbox_test_settlement_not_ok"
      );
    }

    if (
      payload?.diagnostic_only !==
        true
    ) {
      throw new Error(
        "sandbox_test_settlement_not_diagnostic"
      );
    }

    const settlementId =
      rememberSandboxDiagnosticSettlementId(
        payload?.settlement_id
      );

    console.log(
      "STRIPE_SANDBOX_TEST_SETTLEMENT_READY",
      {
        settlement_id:
          settlementId,

        provider:
          normalizeOptionalString(
            payload?.provider
          ),

        source_country:
          normalizeOptionalString(
            payload?.source_country
          ),

        diagnostic_only:
          true
      }
    );

    return settlementId;
  }


  async function ensureSandboxDiagnosticSettlement() {
    requireSandboxMode(
      "sandbox_test_settlement_disabled_in_live_mode"
    );

    if (
      sandboxDiagnosticSettlementId
    ) {
      return sandboxDiagnosticSettlementId;
    }

    if (
      sandboxDiagnosticSettlementPromise
    ) {
      return sandboxDiagnosticSettlementPromise;
    }

    sandboxDiagnosticSettlementPromise =
      createSandboxDiagnosticSettlement()
        .catch(
          (
            error
          ) => {
            sandboxDiagnosticSettlementId =
              null;

            throw error;
          }
        )
        .finally(
          () => {
            sandboxDiagnosticSettlementPromise =
              null;
          }
        );

    return sandboxDiagnosticSettlementPromise;
  }


  /* =========================
     REGISTER LINK USER
  ========================= */

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

    resetStripeCustomerState();

    authenticateButton.disabled =
      true;

    customerContextButton.disabled =
      true;

    kycButton.disabled =
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
      `Creating LinkAuthIntent (${browserConfig?.mode ?? "unknown"})...`
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

    resetStripeCustomerState();

    authenticateButton.disabled =
      false;

    customerContextButton.disabled =
      true;

    kycButton.disabled =
      true;

    console.log(
      "STRIPE_LINK_AUTH_INTENT",
      {
        mode:
          browserConfig?.mode ??
          null,

        authIntentId
      }
    );

    setStatus(
      "LinkAuthIntent created.",
      {
        mode:
          browserConfig?.mode ??
          null,

        authIntentId,

        settlementId:
          resolveDiagnosticSettlementId(),

        sandboxSettlementAutomatic:
          isSandboxMode()
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
      `Starting Link authentication (${browserConfig?.mode ?? "unknown"})...`
    );

    resetStripeCustomerState();

    customerContextButton.disabled =
      true;

    kycButton.disabled =
      true;

    authContainer
      .replaceChildren();

    syncFlowButtons();

    const authenticationElement =
      await sdk.authenticate(
        normalizedAuthIntentId,

        async (
          result
        ) => {
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

            stripeKycVerified =
              false;

            stripeDocumentVerificationStatus =
              null;

            stripeDocumentVerified =
              false;

            resetLimitsState();

            customerContextButton.disabled =
              false;

            kycButton.disabled =
              true;

            syncFlowButtons();

            setStatus(
              "Link authentication successful.",
              {
                mode:
                  browserConfig?.mode ??
                  null,

                result:
                  result.result,

                authIntentId:
                  normalizedAuthIntentId,

                cryptoCustomerId,

                settlementId:
                  resolveDiagnosticSettlementId(),

                sandboxSettlementAutomatic:
                  isSandboxMode(),

                liveSafetyGuard:
                  isLiveMode(),

                nextStep:
                  "Load CryptoCustomer to inspect basic KYC and L2 document-verification state."
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
      `Loading CryptoCustomer (${browserConfig?.mode ?? "unknown"})...`
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

    stripeKycVerified =
      isKycVerified(
        payload
      );

    stripeDocumentVerificationStatus =
      getDocumentVerificationStatus(
        payload
      );

    stripeDocumentVerified =
      isDocumentVerified(
        payload
      );

    syncKycActionButton();
    syncFlowButtons();

    console.log(
      "STRIPE_CUSTOMER_CONTEXT",
      payload
    );

    console.log(
      "STRIPE_VERIFICATION_STATE",
      {
        kyc_verified:
          stripeKycVerified,

        id_document_verified:
          stripeDocumentVerificationStatus,

        l2_verified:
          Boolean(
            stripeKycVerified &&
            stripeDocumentVerified
          )
      }
    );

    setStatus(
      "CryptoCustomer loaded.",
      {
        mode:
          browserConfig?.mode ??
          null,

        ...payload,

        settlementId:
          resolveDiagnosticSettlementId(),

        sandboxSettlementAutomatic:
          isSandboxMode(),

        sandboxSettlementCreated:
          Boolean(
            sandboxDiagnosticSettlementId
          ),

        kycAlreadyVerified:
          stripeKycVerified,

        documentVerificationStatus:
          stripeDocumentVerificationStatus,

        l2Verified:
          Boolean(
            stripeKycVerified &&
            stripeDocumentVerified
          ),

        documentVerificationEnabled:
          canStartDocumentVerification(),

        transactionLimitsEnabled:
          canLoadTransactionLimits(),

        achCollectionEnabled:
          canCollectAch(),

        headlessSessionEnabled:
          canCreateHeadlessSession(),

        checkoutEnabled:
          canPerformCheckout(),

        liveSafetyGuard:
          isLiveMode(),

        nextStep:
          getCustomerNextStep()
      }
    );

    return payload;
  }


  /* =========================
     SUBMIT BASIC KYC
     SANDBOX ONLY
  ========================= */

  async function submitStripeKyc() {
    requireSandboxMode(
      "stripe_kyc_disabled_in_live_mode"
    );

    if (
      stripeKycVerified
    ) {
      throw new Error(
        "stripe_kyc_already_verified"
      );
    }

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

    resetLimitsState();

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
     L2 DOCUMENT VERIFICATION
     SANDBOX ONLY
  ========================= */

  async function verifyStripeDocuments() {
    requireSandboxMode(
      "stripe_document_verification_disabled_in_live_mode"
    );

    requireString(
      cryptoCustomerId,
      "missing_crypto_customer_id"
    );

    if (
      !stripeKycVerified
    ) {
      throw new Error(
        "stripe_kyc_not_verified"
      );
    }

    if (
      stripeDocumentVerified
    ) {
      throw new Error(
        "stripe_document_already_verified"
      );
    }

    if (
      stripeDocumentVerificationStatus !==
        "not_started"
    ) {
      throw new Error(
        `stripe_document_verification_not_startable:${
          stripeDocumentVerificationStatus ??
          "unknown"
        }`
      );
    }

    const sdk =
      await ensureSdk();

    if (
      typeof sdk.verifyDocuments !==
        "function"
    ) {
      throw new Error(
        "verifyDocuments_not_available"
      );
    }

    resetLimitsState();

    setStatus(
      "Starting Stripe L2 document verification (photo ID + selfie)..."
    );

    const result =
      await sdk.verifyDocuments();

    console.log(
      "STRIPE_DOCUMENT_VERIFICATION_FLOW_COMPLETE",
      {
        completed:
          true
      }
    );

    return result;
  }


  /* =========================
     TRANSACTION LIMITS
  ========================= */

  async function loadTransactionLimits() {
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

    if (
      !stripeKycVerified
    ) {
      throw new Error(
        "stripe_kyc_not_verified"
      );
    }

    if (
      !stripeDocumentVerified
    ) {
      throw new Error(
        "stripe_l2_document_verification_required"
      );
    }

    /*
    --------------------------------------------------
    Sandbox:

    Create/reuse the clean server-side US diagnostic
    settlement bound to the current Clerk customer.

    Live:

    Keep the old explicit settlement-ID requirement.
    --------------------------------------------------
    */

    const settlementId =
      isSandboxMode()
        ? await ensureSandboxDiagnosticSettlement()
        : requireDiagnosticSettlementId();

    setStatus(
      `Loading settlement-bound Stripe ACH transaction limits (${browserConfig?.mode ?? "unknown"})...`,
      {
        settlementId,

        sandboxDiagnostic:
          isSandboxMode()
      }
    );

    achLimitsAvailable =
      false;

    transactionLimits =
      null;

    resetPaymentMethodState();

    syncFlowButtons();

    const headers =
      await buildAuthenticatedJsonHeaders();

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
      const error =
        new Error(
          payload?.error?.message ||
          payload?.message ||
          `transaction_limits_http_${response.status}`
        );

      error.status =
        response.status;

      error.payload =
        payload;

      throw error;
    }

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

    achLimitsAvailable =
      payload?.available ===
      true;

    transactionLimits = {
      settlementId:
        responseSettlementId,

      currency,

      paymentMethod,

      available:
        achLimitsAvailable,

      limits:
        Array.isArray(
          payload?.limits
        )
          ? payload.limits
          : []
    };

    syncFlowButtons();

    console.log(
      "STRIPE_TRANSACTION_LIMITS",
      {
        settlement_id:
          transactionLimits
            .settlementId,

        currency:
          transactionLimits
            .currency,

        payment_method:
          transactionLimits
            .paymentMethod,

        available:
          transactionLimits
            .available,

        limits:
          transactionLimits
            .limits
      }
    );

    setStatus(
      "Stripe ACH transaction limits loaded.",
      {
        mode:
          browserConfig?.mode ??
          null,

        settlementId:
          transactionLimits
            .settlementId,

        sandboxDiagnostic:
          isSandboxMode(),

        currency:
          transactionLimits
            .currency,

        paymentMethod:
          transactionLimits
            .paymentMethod,

        available:
          transactionLimits
            .available,

        limits:
          transactionLimits
            .limits,

        l2Verified:
          true,

        achCollectionEnabled:
          canCollectAch(),

        nextStep:
          transactionLimits
            .available
            ? "ACH is available. Collect ACH payment method."
            : "ACH limit is still unavailable after L2 verification."
      }
    );

    return transactionLimits;
  }


  /* =========================
     COLLECT ACH PAYMENT METHOD
  ========================= */

  async function collectAchPaymentMethod() {
    requireSandboxMode(
      "ach_collection_disabled_in_live_mode"
    );

    const sdk =
      await ensureSdk();

    requireString(
      cryptoCustomerId,
      "missing_crypto_customer_id"
    );

    if (
      !stripeKycVerified ||
      !stripeDocumentVerified
    ) {
      throw new Error(
        "stripe_l2_verification_required"
      );
    }

    if (
      !achLimitsAvailable
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

        (
          result
        ) => {
          const token =
            result?.cryptoPaymentToken ??
            result?.crypto_payment_token ??
            null;

          if (token) {
            cryptoPaymentToken =
              requireString(
                token,
                "missing_crypto_payment_token"
              );

            syncFlowButtons();

            console.log(
              "STRIPE_PAYMENT_METHOD_READY",
              {
                payment_token_ready:
                  true
              }
            );

            setStatus(
              "ACH payment method collected.",
              {
                settlementId:
                  resolveDiagnosticSettlementId(),

                l2Verified:
                  true,

                achLimitsAvailable,

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

          if (
            result?.result ===
              "abandoned"
          ) {
            setStatus(
              "ACH payment-method collection abandoned."
            );

            syncFlowButtons();

            return;
          }

          if (
            result?.error
          ) {
            setStatus(
              "ACH payment-method collection failed.",
              {
                message:
                  result?.error?.message ??
                  "stripe_ach_collection_failed"
              }
            );

            syncFlowButtons();

            return;
          }

          setStatus(
            "ACH payment-method callback received without a payment token."
          );

          syncFlowButtons();
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
     CREATE HEADLESS SESSION + QUOTE
  ========================= */

  async function createAchHeadlessSession() {
    requireSandboxMode(
      "headless_session_disabled_in_live_mode"
    );

    const settlementId =
      requireDiagnosticSettlementId();

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

    const normalizedCryptoPaymentToken =
      requireString(
        cryptoPaymentToken,
        "missing_crypto_payment_token"
      );

    if (
      !stripeKycVerified ||
      !stripeDocumentVerified
    ) {
      throw new Error(
        "stripe_l2_verification_required"
      );
    }

    if (
      !achLimitsAvailable
    ) {
      throw new Error(
        "stripe_ach_limits_not_available"
      );
    }

    resetCheckoutState();

    setStatus(
      "Creating settlement-bound ACH Headless Session...",
      {
        settlementId,

        sandboxDiagnostic:
          true
      }
    );

    const headers =
      await buildAuthenticatedJsonHeaders();

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
      const error =
        new Error(
          payload?.error?.message ||
          payload?.message ||
          `headless_session_http_${response.status}`
        );

      error.status =
        response.status;

      error.payload =
        payload;

      throw error;
    }

    headlessSession =
      normalizeHeadlessSessionPayload(
        payload,
        settlementId
      );

    checkoutCompleted =
      false;

    syncFlowButtons();

    console.log(
      "STRIPE_ACH_HEADLESS_SESSION_READY",
      {
        settlement_id:
          headlessSession
            .settlementId,

        session_id:
          headlessSession
            .sessionId,

        status:
          headlessSession
            .status,

        livemode:
          headlessSession
            .livemode,

        source_amount:
          headlessSession
            .sourceAmount,

        source_currency:
          headlessSession
            .sourceCurrency,

        destination_amount:
          headlessSession
            .destinationAmount,

        destination_currency:
          headlessSession
            .destinationCurrency,

        destination_network:
          headlessSession
            .destinationNetwork,

        quote_expiration:
          headlessSession
            .quoteExpiration,

        client_secret_ready:
          true
      }
    );

    setStatus(
      "ACH Headless Session and settlement-bound quote created.",
      {
        settlementId:
          headlessSession
            .settlementId,

        sessionId:
          headlessSession
            .sessionId,

        status:
          headlessSession
            .status,

        livemode:
          headlessSession
            .livemode,

        quote: {
          sourceAmount:
            headlessSession
              .sourceAmount,

          sourceCurrency:
            headlessSession
              .sourceCurrency,

          destinationAmount:
            headlessSession
              .destinationAmount,

          destinationCurrency:
            headlessSession
              .destinationCurrency,

          destinationNetwork:
            headlessSession
              .destinationNetwork,

          quoteExpiration:
            headlessSession
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

    return headlessSession;
  }


  /* =========================
     PERFORM CHECKOUT
  ========================= */

  async function performHeadlessCheckout() {
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
      !headlessSession
    ) {
      throw new Error(
        "missing_headless_session"
      );
    }

    const sessionId =
      requireString(
        headlessSession
          .sessionId,
        "stripe_checkout_missing_session_id"
      );

    const clientSecret =
      requireString(
        headlessSession
          .clientSecret,
        "stripe_checkout_missing_client_secret"
      );

    setStatus(
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

    checkoutCompleted =
      true;

    syncFlowButtons();

    console.log(
      "STRIPE_HEADLESS_CHECKOUT_COMPLETED",
      {
        settlement_id:
          headlessSession
            .settlementId,

        session_id:
          headlessSession
            .sessionId,

        successful:
          true
      }
    );

    setStatus(
      "Stripe ACH checkout completed.",
      {
        settlementId:
          headlessSession
            .settlementId,

        sessionId:
          headlessSession
            .sessionId,

        successful:
          true,

        nextStep:
          "Verify funding confirmation / settlement lifecycle."
      }
    );

    return {
      successful:
        true
    };
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
        } catch (
          error
        ) {
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
            !isSandboxMode();

          syncKycActionButton();
          syncFlowButtons();
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

        authIntentId =
          null;

        resetStripeCustomerState();

        authContainer
          .replaceChildren();

        try {
          await createLinkAuthIntent();
        } catch (
          error
        ) {
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

          syncKycActionButton();
          syncFlowButtons();
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

        resetStripeCustomerState();

        try {
          await authenticateLinkUser();
        } catch (
          error
        ) {
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
        } finally {
          syncFlowButtons();
        }
      }
    );


  customerContextButton
    .addEventListener(
      "click",
      async () => {
        customerContextButton.disabled =
          true;

        let customerContextLoaded =
          false;

        try {
          await loadCustomerContext();

          customerContextLoaded =
            true;
        } catch (
          error
        ) {
          console.error(
            "STRIPE_CUSTOMER_CONTEXT_FAILED",
            error
          );

          stripeKycVerified =
            false;

          stripeDocumentVerificationStatus =
            null;

          stripeDocumentVerified =
            false;

          resetLimitsState();

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
        } finally {
          customerContextButton.disabled =
            false;

          if (
            customerContextLoaded
          ) {
            syncKycActionButton();
          } else {
            kycButton.disabled =
              true;
          }

          syncFlowButtons();
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

        let actionCompleted =
          false;

        let actionType =
          null;

        try {
          if (
            !stripeKycVerified
          ) {
            actionType =
              "basic_kyc";

            const kycResult =
              await submitStripeKyc();

            actionCompleted =
              true;

            console.log(
              "STRIPE_SUBMIT_KYC_COMPLETE",
              kycResult
            );

            setStatus(
              "Stripe KYC submitted.",
              {
                submitted:
                  true,

                nextStep:
                  "Load CryptoCustomer again. If basic KYC is verified, continue to L2 document verification."
              }
            );

            return;
          }

          if (
            canStartDocumentVerification()
          ) {
            actionType =
              "document_verification";

            await verifyStripeDocuments();

            actionCompleted =
              true;

            setStatus(
              "Stripe L2 document-verification flow completed.",
              {
                documentFlowCompleted:
                  true,

                nextStep:
                  "Load CryptoCustomer again and confirm id_document_verified = verified before testing ACH transaction limits."
              }
            );

            return;
          }

          if (
            stripeDocumentVerified
          ) {
            throw new Error(
              "stripe_l2_already_verified"
            );
          }

          throw new Error(
            `stripe_kyc_action_not_available:${
              stripeDocumentVerificationStatus ??
              "unknown"
            }`
          );
        } catch (
          error
        ) {
          console.error(
            "STRIPE_KYC_ACTION_FAILED",
            error
          );

          setStatus(
            actionType ===
              "document_verification"
              ? "Stripe L2 document verification failed."
              : "Stripe KYC failed.",
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
          customerContextButton.disabled =
            false;

          if (
            actionCompleted
          ) {
            kycButton.disabled =
              true;
          } else {
            syncKycActionButton();
          }

          syncFlowButtons();
        }
      }
    );


  transactionLimitsButton
    .addEventListener(
      "click",
      async () => {
        transactionLimitsButton.disabled =
          true;

        try {
          await loadTransactionLimits();
        } catch (
          error
        ) {
          console.error(
            "STRIPE_TRANSACTION_LIMITS_FAILED",
            error
          );

          achLimitsAvailable =
            false;

          transactionLimits =
            null;

          resetPaymentMethodState();

          setStatus(
            "Stripe transaction limits failed.",
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
                null,

              settlementId:
                resolveDiagnosticSettlementId()
            }
          );
        } finally {
          syncFlowButtons();
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
        } catch (
          error
        ) {
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
                )
            }
          );
        } finally {
          syncFlowButtons();
        }
      }
    );


  headlessSessionButton
    .addEventListener(
      "click",
      async () => {
        headlessSessionButton.disabled =
          true;

        try {
          await createAchHeadlessSession();
        } catch (
          error
        ) {
          console.error(
            "STRIPE_ACH_HEADLESS_SESSION_FAILED",
            error
          );

          resetCheckoutState();

          setStatus(
            "ACH Headless Session failed.",
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
          syncFlowButtons();
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
          await performHeadlessCheckout();
        } catch (
          error
        ) {
          console.error(
            "STRIPE_HEADLESS_CHECKOUT_FAILED",
            error
          );

          setStatus(
            "Stripe ACH checkout failed.",
            {
              message:
                error?.message ??
                String(
                  error
                )
            }
          );
        } finally {
          syncFlowButtons();
        }
      }
    );


  /* =========================
     INIT
  ========================= */

  try {
    assertDom();

    configureCurrentDiagnosticUi();

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

    transactionLimitsButton.disabled =
      true;

    headlessSessionButton.disabled =
      true;

    quoteButton.disabled =
      true;

    setStatus(
      "Loading Stripe backend configuration..."
    );

    ensureSdk()
      .then(
        () => {
          registerButton.disabled =
            !isSandboxMode();

          authIntentButton.disabled =
            false;

          authenticateButton.disabled =
            true;

          customerContextButton.disabled =
            true;

          kycButton.disabled =
            true;

          syncFlowButtons();

          const settlementId =
            resolveDiagnosticSettlementId();

          setStatus(
            "Stripe Embedded Components SDK initialized.",
            {
              mode:
                browserConfig?.mode ??
                null,

              isSandbox:
                browserConfig?.isSandbox ??
                null,

              settlementId,

              settlementReady:
                Boolean(
                  settlementId
                ),

              sandboxSettlementAutomatic:
                isSandboxMode(),

              liveSafetyGuard:
                isLiveMode(),

              enabledFlow:
                isLiveMode()
                  ? [
                      "Create LinkAuthIntent",
                      "Authenticate",
                      "Load CryptoCustomer",
                      "Get settlement-bound ACH transaction limits for an already-L2-verified customer"
                    ]
                  : [
                      "Register Link user",
                      "Create LinkAuthIntent",
                      "Authenticate",
                      "Load CryptoCustomer",
                      "Submit basic KYC only if required",
                      "Complete L2 photo ID + selfie verification",
                      "Reload CryptoCustomer",
                      "Automatically create US sandbox diagnostic settlement",
                      "Get ACH transaction limits",
                      "Collect ACH",
                      "Create ACH Headless Session + Quote",
                      "Perform Checkout"
                    ],

              diagnosticNote:
                isSandboxMode()
                  ? "No settlementId is required in the URL. A clean authenticated US sandbox diagnostic settlement will be created automatically when transaction limits are requested."
                  : settlementId
                    ? "Settlement-bound live-safe diagnostics are ready."
                    : "Add ?settlementId=<SETTLEMENT_ID> to this URL before testing live-safe transaction limits."
            }
          );
        }
      )
      .catch(
        (
          error
        ) => {
          console.error(
            "STRIPE_CRYPTO_INIT_FAILED",
            error
          );

          setStatus(
            "Stripe SDK initialization failed.",
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
        }
      );
  } catch (
    error
  ) {
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
