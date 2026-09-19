// unibrij/unibridge-landing/surface/js/ramp/stripeOnramp.js

window.UnibridgeStripeOnramp = (() => {
  const CONTAINER_ID =
    "stripeOnrampContainer";


  let stripeRuntimeModule = null;
  let stripeIdentityModule = null;
  let stripeHeadlessModule = null;

  let stripeConsumerWalletModule = null;
  let stripeLimitsModule = null;
  let stripePaymentMethodModule = null;

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
      stripeIdentityModule
        ?.resetStripeIdentityFlow?.();
    } catch (
      error
    ) {
      console.warn(
        "STRIPE_IDENTITY_RESET_FAILED",
        error
      );
    }

    clearContainer();
  }


  /*
  --------------------------------------------------
  Focused Stripe module loading

  stripeRuntime.js:
    browser config + Stripe SDK initialization

  stripeIdentity.js:
    Clerk email + Link auth + CryptoCustomer + KYC/L2

  stripeHeadless.js:
    Headless create + checkout lifecycle

  This file remains the Surface flow orchestrator.
  --------------------------------------------------
  */

  async function ensureStripeRuntimeModule() {
    if (stripeRuntimeModule) {
      return stripeRuntimeModule;
    }

    stripeRuntimeModule =
      await import(
        "/surface/js/ramp/stripeEmbedded/stripeRuntime.js"
      );

    return stripeRuntimeModule;
  }


  async function ensureStripeIdentityModule() {
    if (stripeIdentityModule) {
      return stripeIdentityModule;
    }

    stripeIdentityModule =
      await import(
        "/surface/js/ramp/stripeEmbedded/stripeIdentity.js"
      );

    return stripeIdentityModule;
  }


  async function ensureStripeHeadlessModule() {
    if (stripeHeadlessModule) {
      return stripeHeadlessModule;
    }

    stripeHeadlessModule =
      await import(
        "/surface/js/ramp/stripeEmbedded/stripeHeadless.js"
      );

    return stripeHeadlessModule;
  }


  async function ensureStripeRuntimeSdk() {
    const runtimeModule =
      await ensureStripeRuntimeModule();

    const ensureStripeSdk =
      runtimeModule
        ?.ensureStripeSdk;

    if (
      typeof ensureStripeSdk !==
        "function"
    ) {
      throw new Error(
        "stripe_runtime_sdk_missing"
      );
    }

    return ensureStripeSdk();
  }


  async function ensureStripeConsumerWalletModule() {
    if (stripeConsumerWalletModule) {
      return stripeConsumerWalletModule;
    }

    stripeConsumerWalletModule =
      await import(
        "/surface/js/ramp/stripeEmbedded/stripeConsumerWallet.js"
      );

    return stripeConsumerWalletModule;
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


  async function ensureStripePaymentMethodModule() {
    if (stripePaymentMethodModule) {
      return stripePaymentMethodModule;
    }

    stripePaymentMethodModule =
      await import(
        "/surface/js/ramp/stripeEmbedded/stripePaymentMethod.js"
      );

    return stripePaymentMethodModule;
  }


  async function ensureSettlementConsumerWallet({
    sdk: stripeSdk,
    settlementId,
    authIntentId,
    cryptoCustomerId,
    setStatus,
    flowToken
  }) {
    const {
      ensureStripeConsumerWallet
    } =
      await ensureStripeConsumerWalletModule();

    if (
      typeof ensureStripeConsumerWallet !==
        "function"
    ) {
      throw new Error(
        "stripe_consumer_wallet_runtime_missing"
      );
    }

    assertActiveFlow(
      flowToken
    );

    setStatus(
      "Preparing your secure Stripe wallet..."
    );

    const walletContext =
      await ensureStripeConsumerWallet({
        sdk:
          stripeSdk,

        settlementId,
        authIntentId,
        cryptoCustomerId
      });

    assertActiveFlow(
      flowToken
    );

    if (
      walletContext?.registered !==
        true
    ) {
      throw new Error(
        "stripe_consumer_wallet_not_registered"
      );
    }

    return walletContext;
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


  async function collectAchPaymentMethod({
    sdk: stripeSdk,
    container,
    setStatus,
    flowToken
  }) {
    const {
      startStripeAchPaymentMethodCollection
    } =
      await ensureStripePaymentMethodModule();

    if (
      typeof startStripeAchPaymentMethodCollection !==
        "function"
    ) {
      throw new Error(
        "stripe_payment_method_runtime_missing"
      );
    }

    assertActiveFlow(
      flowToken
    );

    setStatus(
      "Connect your bank account to continue."
    );

    const collection =
      await startStripeAchPaymentMethodCollection({
        sdk:
          stripeSdk
      });

    assertActiveFlow(
      flowToken
    );

    container.replaceChildren(
      collection.element
    );

    const completed =
      await collection.completion;

    assertActiveFlow(
      flowToken
    );

    container.replaceChildren();

    return requireString(
      completed?.cryptoPaymentToken,
      "missing_crypto_payment_token"
    );
  }


  /*
  --------------------------------------------------
  Surface Stripe orchestration

  Visible flow:

  Stripe runtime
      ↓
  Stripe identity
      ↓
  settlement ConsumerWallet
      ↓
  ACH limits
      ↓
  ACH payment method
      ↓
  Headless session create
      ↓
  Headless checkout
      ↓
  funding observation

  This function owns:

  - stage ordering
  - visible status
  - Surface container
  - active-flow cancellation

  Provider mechanics remain delegated.
  --------------------------------------------------
  */

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


    const assertCurrentFlow =
      () => {
        assertActiveFlow(
          flowToken
        );
      };


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


    /*
    --------------------------------------------------
    Load independent Stripe modules in parallel.

    Identity module loading is shared with the email
    lookup so it is not imported twice.
    --------------------------------------------------
    */

    const identityModulePromise =
      ensureStripeIdentityModule();


    const [
      stripeSdk,
      identityModule,
      headlessModule,
      email
    ] =
      await Promise.all([
        ensureStripeRuntimeSdk(),

        identityModulePromise,

        ensureStripeHeadlessModule(),

        identityModulePromise
          .then(
            (
              module
            ) => {
              const resolveAuthenticatedStripeEmail =
                module
                  ?.resolveAuthenticatedStripeEmail;

              if (
                typeof resolveAuthenticatedStripeEmail !==
                  "function"
              ) {
                throw new Error(
                  "stripe_identity_email_runtime_missing"
                );
              }

              return resolveAuthenticatedStripeEmail();
            }
          )
      ]);


    assertCurrentFlow();


    const runStripeIdentityStage =
      identityModule
        ?.runStripeIdentityStage;

    const createStripeHeadlessSession =
      headlessModule
        ?.createStripeHeadlessSession;

    const performStripeHeadlessCheckout =
      headlessModule
        ?.performStripeHeadlessCheckout;


    if (
      typeof runStripeIdentityStage !==
        "function"
    ) {
      throw new Error(
        "stripe_identity_runtime_missing"
      );
    }

    if (
      typeof createStripeHeadlessSession !==
        "function" ||
      typeof performStripeHeadlessCheckout !==
        "function"
    ) {
      throw new Error(
        "stripe_headless_runtime_missing"
      );
    }


    /*
    --------------------------------------------------
    Stripe identity stage

    stripeIdentity.js owns:

    Clerk email
      → LinkAuthIntent
      → Stripe Link authentication
      → CryptoCustomer
      → basic KYC
      → L2 document/selfie
      → final verified identity

    No ConsumerWallet / limits / ACH / Headless work
    begins until this stage returns successfully.
    --------------------------------------------------
    */

    const identity =
      await runStripeIdentityStage({
        sdk:
          stripeSdk,

        container,

        email,

        setStatus,

        assertActive:
          assertCurrentFlow
      });


    assertCurrentFlow();


    const authIntentId =
      requireString(
        identity
          ?.authIntentId,
        "missing_auth_intent_id"
      );

    const cryptoCustomerId =
      requireString(
        identity
          ?.cryptoCustomerId,
        "missing_crypto_customer_id"
      );


    console.log(
      "STRIPE_HEADLESS_KYC_READY",
      {
        settlement_id:
          settlementId,

        kyc_status:
          identity
            ?.kycStatus ??
          null,

        document_status:
          identity
            ?.documentStatus ??
          null
      }
    );


    container.replaceChildren();


    /*
    --------------------------------------------------
    Settlement ConsumerWallet

    Stripe must know the exact canonical wallet already
    assigned to this real settlement.

    Wallet address and network originate from the
    backend FundingSession.

    No browser-selected wallet/network is accepted.
    --------------------------------------------------
    */

    const walletContext =
      await ensureSettlementConsumerWallet({
        sdk:
          stripeSdk,

        settlementId,

        authIntentId,

        cryptoCustomerId,

        setStatus,

        flowToken
      });


    assertCurrentFlow();


    console.log(
      "STRIPE_CONSUMER_WALLET_READY",
      {
        settlement_id:
          settlementId,

        registered:
          walletContext
            .registered ===
          true,

        network:
          walletContext
            .network,

        consumer_wallet_ready:
          Boolean(
            walletContext
              .consumerWalletId
          )
      }
    );


    /*
    --------------------------------------------------
    ACH limits

    Checked only after:

    - final L2 verification
    - settlement ConsumerWallet registration
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


    assertCurrentFlow();


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


    /*
    --------------------------------------------------
    ACH payment-method collection

    Begins only after:

    - KYC/L2 verified
    - ConsumerWallet confirmed
    - ACH limits available
    --------------------------------------------------
    */

    const cryptoPaymentToken =
      await collectAchPaymentMethod({
        sdk:
          stripeSdk,

        container,

        setStatus,

        flowToken
      });


    assertCurrentFlow();


    console.log(
      "STRIPE_HEADLESS_ACH_PAYMENT_METHOD_READY",
      {
        settlement_id:
          settlementId,

        payment_token_ready:
          Boolean(
            cryptoPaymentToken
          )
      }
    );


    /*
    --------------------------------------------------
    Create and bind Stripe Headless Session

    stripeHeadless.js sends only correlation IDs and
    the Stripe payment token.

    Backend resolves canonical:

    - amount
    - source currency
    - destination asset
    - network
    - wallet
    - settlement speed

    Backend persists the authoritative Headless Session
    binding before returning.
    --------------------------------------------------
    */

    assertCurrentFlow();

    setStatus(
      "Creating secure Stripe payment session..."
    );


    const headlessSession =
      await createStripeHeadlessSession({
        settlementId,

        authIntentId,

        cryptoCustomerId,

        cryptoPaymentToken
      });


    assertCurrentFlow();


    console.log(
      "STRIPE_HEADLESS_SESSION_READY",
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
            .quoteExpiration
      }
    );


    if (
      typeof ctx.emit ===
        "function"
    ) {
      ctx.emit(
        "unibridge:quote"
      );
    }


    /*
    --------------------------------------------------
    Headless checkout

    Critical invariant:

    create-stage client_secret is NOT reused here.

    stripeHeadless.js allows Stripe SDK to request the
    checkout stage.

    Callback:
      → UniBridge /headless-checkout
      → server binding assertion
      → Stripe /checkout
      → checkout-stage client_secret
      → Stripe SDK
    --------------------------------------------------
    */

    assertCurrentFlow();

    setStatus(
      "Confirming Stripe bank payment..."
    );


    const checkoutResult =
      await performStripeHeadlessCheckout({
        sdk:
          stripeSdk,

        settlementId,

        authIntentId,

        headlessSession,

        assertActive:
          assertCurrentFlow
      });


    /*
    --------------------------------------------------
    Successful Stripe checkout boundary

    From this point forward Stripe has already reported
    the bank payment as successfully submitted.

    Do NOT assert active flow after this boundary.

    A later Surface flow replacement must not convert
    the successful Stripe checkout into an error.

    UI/event mutation is allowed only if this remains
    the active Surface flow.
    --------------------------------------------------
    */

    console.log(
      "STRIPE_HEADLESS_CHECKOUT_SUBMITTED",
      {
        settlement_id:
          settlementId,

        session_id:
          headlessSession
            .sessionId,

        successful:
          checkoutResult
            .successful ===
          true,

        submission_recorded:
          checkoutResult
            .submissionRecorded ===
          true
      }
    );


    /*
    --------------------------------------------------
    Checkout successful means submitted.

    It does NOT mean settlement funding has already
    been confirmed.

    Existing funding observation remains authoritative
    for the transition to funding_confirmed.

    If this flow has already been replaced, do not
    mutate the replacement flow UI or emit its payment
    event.
    --------------------------------------------------
    */

    if (
      activeFlowToken ===
        flowToken
    ) {
      if (
        typeof ctx.emit ===
          "function"
      ) {
        ctx.emit(
          "unibridge:payment"
        );
      }


      ctx.setContinueDisabled(
        true
      );

      container.replaceChildren();

      setStatus(
        "Bank payment submitted successfully. We’ll continue processing your transfer automatically. You can safely close this page."
      );
    }


    return true;
  }


  return {
    mount,
    reset
  };
})();
