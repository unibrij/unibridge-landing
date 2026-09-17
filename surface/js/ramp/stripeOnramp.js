// unibrij/unibridge-landing/surface/js/ramp/stripeOnramp.js

window.UnibridgeStripeOnramp = (() => {
  const STRIPE_CRYPTO_MODULE =
    "https://cdn.jsdelivr.net/npm/@stripe/crypto@1.1.0/+esm";

  const STRIPE_BROWSER_CONFIG_URL =
    "/v2/ramp/stripe/browser/config";

  const CONTAINER_ID =
    "stripeOnrampContainer";

  let browserConfig = null;
  let browserConfigPromise = null;

  let sdk = null;
  let sdkPromise = null;

  let stripeCustomerModule = null;
  let stripeKycModule = null;
  let stripeLimitsModule = null;

  let activeFlowToken = null;


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


  function assertActiveFlow(
    token
  ) {
    if (
      !token ||
      activeFlowToken !== token
    ) {
      throw new Error(
        "stripe_headless_flow_replaced"
      );
    }
  }


  function getContainer() {
    let container =
      document.getElementById(
        CONTAINER_ID
      );

    if (container) {
      return container;
    }

    const statusBox =
      document.getElementById(
        "status"
      );

    container =
      document.createElement(
        "div"
      );

    container.id =
      CONTAINER_ID;

    container.style.width =
      "100%";

    container.style.minHeight =
      "220px";

    container.style.marginTop =
      "16px";

    container.style.borderRadius =
      "20px";

    container.style.overflow =
      "hidden";

    if (statusBox?.parentNode) {
      statusBox.parentNode.insertBefore(
        container,
        statusBox
      );
    } else {
      document.body.appendChild(
        container
      );
    }

    return container;
  }


  function clearContainer() {
    document
      .getElementById(
        CONTAINER_ID
      )
      ?.remove();
  }


  function reset() {
    activeFlowToken =
      null;

    try {
      stripeKycModule
        ?.resetStripeKycFlow?.();
    } catch (error) {
      console.warn(
        "STRIPE_KYC_RESET_FAILED",
        error
      );
    }

    clearContainer();
  }


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


  async function ensureSdk() {
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


  async function ensureStripeCustomerModule() {
    if (stripeCustomerModule) {
      return stripeCustomerModule;
    }

    stripeCustomerModule =
      await import(
        "/surface/js/ramp/stripeEmbedded/stripeCustomer.js"
      );

    return stripeCustomerModule;
  }


  async function ensureStripeKycModule() {
    if (stripeKycModule) {
      return stripeKycModule;
    }

    stripeKycModule =
      await import(
        "/surface/js/kyc/stripe/stripeKycFlow.js"
      );

    return stripeKycModule;
  }


  async function ensureStripeLimitsModule() {
    if (stripeLimitsModule) {
      return stripeLimitsModule;
    }

    stripeLimitsModule =
      await import(
        "/surface/js/ramp/stripeEmbedded/stripeLimits.js"
      );

    return stripeLimitsModule;
  }


  async function resolveAuthenticatedEmail() {
    const {
      ensureFiatClerkAuth
    } = await import(
      "/shared/pay/auth/clerkAuth.js"
    );

    if (
      typeof ensureFiatClerkAuth !==
        "function"
    ) {
      throw new Error(
        "surface_customer_auth_unavailable"
      );
    }

    const auth =
      await ensureFiatClerkAuth();

    return requireString(
      auth?.email,
      "authenticated_customer_email_missing"
    )
      .toLowerCase();
  }


  async function authenticateStripeCustomer({
    sdk: stripeSdk,
    container,
    email,
    setStatus,
    flowToken
  }) {
    const {
      createStripeLinkAuthIntent,
      startStripeCustomerAuthentication
    } =
      await ensureStripeCustomerModule();

    assertActiveFlow(
      flowToken
    );

    setStatus(
      "Starting secure Stripe authentication..."
    );

    const {
      authIntentId
    } =
      await createStripeLinkAuthIntent({
        email
      });

    assertActiveFlow(
      flowToken
    );

    const authentication =
      await startStripeCustomerAuthentication({
        sdk:
          stripeSdk,

        authIntentId
      });

    assertActiveFlow(
      flowToken
    );

    container.replaceChildren(
      authentication.element
    );

    setStatus(
      "Complete Stripe authentication to continue."
    );

    const completed =
      await authentication.completion;

    assertActiveFlow(
      flowToken
    );

    container.replaceChildren();

    return {
      authIntentId:
        requireString(
          completed?.authIntentId ??
          authIntentId,
          "missing_auth_intent_id"
        ),

      cryptoCustomerId:
        requireString(
          completed?.cryptoCustomerId,
          "missing_crypto_customer_id"
        )
    };
  }


  async function loadCryptoCustomer({
    authIntentId,
    cryptoCustomerId,
    flowToken
  }) {
    const {
      loadStripeCryptoCustomer
    } =
      await ensureStripeCustomerModule();

    const customer =
      await loadStripeCryptoCustomer({
        authIntentId,
        cryptoCustomerId
      });

    assertActiveFlow(
      flowToken
    );

    return customer;
  }


  async function runStripeIdentityFlow({
    sdk: stripeSdk,
    authIntentId,
    cryptoCustomerId,
    setStatus,
    flowToken
  }) {
    const customerModule =
      await ensureStripeCustomerModule();

    const kycModule =
      await ensureStripeKycModule();

    const {
      getStripeVerificationStatus,
      isStripeVerificationVerified
    } =
      customerModule;

    const {
      runStripeKycFlow
    } =
      kycModule;

    let customer =
      await loadCryptoCustomer({
        authIntentId,
        cryptoCustomerId,
        flowToken
      });

    if (
      isStripeVerificationVerified(
        customer,
        "kyc_verified"
      )
    ) {
      return customer;
    }

    setStatus(
      "Complete Stripe identity verification."
    );

    await runStripeKycFlow({
      sdk:
        stripeSdk,

      includeUsStepUp:
        true,

      setStatus
    });

    assertActiveFlow(
      flowToken
    );

    /*
    --------------------------------------------------
    Critical ordering:

    Never inspect limits here.
    First reload Stripe CryptoCustomer after textual
    KYC / SSN submission.
    --------------------------------------------------
    */

    customer =
      await loadCryptoCustomer({
        authIntentId,
        cryptoCustomerId,
        flowToken
      });

    if (
      isStripeVerificationVerified(
        customer,
        "kyc_verified"
      )
    ) {
      return customer;
    }

    const documentStatus =
      getStripeVerificationStatus(
        customer,
        "id_document_verified"
      );

    if (
      documentStatus ===
        "not_started"
    ) {
      if (
        typeof stripeSdk.verifyDocuments !==
          "function"
      ) {
        throw new Error(
          "stripe_verify_documents_not_available"
        );
      }

      setStatus(
        "Stripe needs a photo ID and selfie to continue."
      );

      await stripeSdk.verifyDocuments();

      assertActiveFlow(
        flowToken
      );

      /*
      --------------------------------------------------
      Reload again after Stripe document verification.
      --------------------------------------------------
      */

      customer =
        await loadCryptoCustomer({
          authIntentId,
          cryptoCustomerId,
          flowToken
        });
    }

    if (
      !isStripeVerificationVerified(
        customer,
        "kyc_verified"
      )
    ) {
      const error =
        new Error(
          "stripe_kyc_not_verified"
        );

      error.verificationStatus =
        getStripeVerificationStatus(
          customer,
          "kyc_verified"
        );

      error.documentVerificationStatus =
        getStripeVerificationStatus(
          customer,
          "id_document_verified"
        );

      throw error;
    }

    return customer;
  }


  async function loadAchLimits({
    settlementId,
    authIntentId,
    cryptoCustomerId,
    setStatus,
    flowToken
  }) {
    const {
      loadStripeTransactionLimits
    } =
      await ensureStripeLimitsModule();

    if (
      typeof loadStripeTransactionLimits !==
        "function"
    ) {
      throw new Error(
        "stripe_limits_runtime_missing"
      );
    }

    assertActiveFlow(
      flowToken
    );

    setStatus(
      "Checking Stripe bank transfer availability..."
    );

    const limits =
      await loadStripeTransactionLimits({
        settlementId,
        authIntentId,
        cryptoCustomerId
      });

    assertActiveFlow(
      flowToken
    );

    if (
      limits?.available !==
        true
    ) {
      throw new Error(
        "stripe_ach_unavailable"
      );
    }

    return limits;
  }


  async function mount(
    ctx,
    action
  ) {
    if (
      !ctx ||
      typeof ctx.setStatus !==
        "function" ||
      typeof ctx.setContinueDisabled !==
        "function"
    ) {
      throw new Error(
        "stripe_onramp_context_invalid"
      );
    }

    const settlementId =
      requireString(
        typeof ctx.getSettlementId ===
          "function"
          ? ctx.getSettlementId()
          : action?.meta?.settlement_id,
        "missing_settlement_id"
      );

    const actionSettlementId =
      normalizeString(
        action?.meta?.settlement_id
      );

    if (
      actionSettlementId &&
      actionSettlementId !==
        settlementId
    ) {
      throw new Error(
        "stripe_settlement_context_mismatch"
      );
    }

    reset();

    const flowToken = {};

    activeFlowToken =
      flowToken;

    const setStatus =
      (
        message,
        type
      ) => {
        if (
          activeFlowToken !==
            flowToken
        ) {
          return;
        }

        ctx.setStatus(
          message,
          type
        );
      };

    ctx.setContinueDisabled(
      true
    );

    setStatus(
      "Preparing Stripe bank funding..."
    );

    const container =
      getContainer();

    const [
      stripeSdk,
      email
    ] =
      await Promise.all([
        ensureSdk(),
        resolveAuthenticatedEmail()
      ]);

    assertActiveFlow(
      flowToken
    );

    const {
      authIntentId,
      cryptoCustomerId
    } =
      await authenticateStripeCustomer({
        sdk:
          stripeSdk,

        container,
        email,
        setStatus,
        flowToken
      });

    assertActiveFlow(
      flowToken
    );

    const customer =
      await runStripeIdentityFlow({
        sdk:
          stripeSdk,

        authIntentId,
        cryptoCustomerId,
        setStatus,
        flowToken
      });

    assertActiveFlow(
      flowToken
    );

    const {
      getStripeVerificationStatus
    } =
      await ensureStripeCustomerModule();

    console.log(
      "STRIPE_HEADLESS_KYC_READY",
      {
        settlement_id:
          settlementId,

        kyc_status:
          getStripeVerificationStatus(
            customer,
            "kyc_verified"
          ),

        document_status:
          getStripeVerificationStatus(
            customer,
            "id_document_verified"
          )
      }
    );

    container.replaceChildren();

    /*
    --------------------------------------------------
    Transaction limits must be loaded only after the
    final post-KYC CryptoCustomer reload.
    --------------------------------------------------
    */

    const limits =
      await loadAchLimits({
        settlementId,
        authIntentId,
        cryptoCustomerId,
        setStatus,
        flowToken
      });

    assertActiveFlow(
      flowToken
    );

    console.log(
      "STRIPE_HEADLESS_ACH_LIMITS_READY",
      {
        settlement_id:
          settlementId,

        available:
          limits.available,

        limit_count:
          Array.isArray(
            limits.limits
          )
            ? limits.limits.length
            : 0
      }
    );

    setStatus(
      "Stripe bank transfer is available. Preparing payment..."
    );

    /*
    --------------------------------------------------
    Intentional stop point for this migration step.

    Stripe KYC is complete.
    CryptoCustomer has been reloaded.
    ACH transaction limits are confirmed available.

    DO NOT collect us_bank_account here yet.
    DO NOT create the headless session here yet.
    DO NOT request session pricing here yet.
    DO NOT performCheckout() here yet.
    --------------------------------------------------
    */

    return true;
  }


  return {
    mount,
    reset
  };
})();
