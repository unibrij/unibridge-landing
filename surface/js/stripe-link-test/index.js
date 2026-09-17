// unibridge-landing/surface/js/stripe-link-test/index.js

/*
--------------------------------------------------
Stripe diagnostic — orchestrator

Owns ONLY:

- shared diagnostic state
- state reset hierarchy
- action / interaction lock state
- derived flow guards
- flow-button synchronization
- KYC-button synchronization
- module composition
- event wiring
- action-level error handling
- page bootstrap

Does NOT own:

- DOM implementation
- Clerk session/token implementation
- Stripe SDK implementation
- KYC payload implementation
- settlement creation implementation
- funding API implementation

Important:

syncFlowUi() NEVER synchronizes the KYC button.

KYC synchronization remains intentionally separate because
successful KYC/document-verification actions must keep the
KYC action disabled until CryptoCustomer is reloaded.

Re-entrancy invariant:

An action already in progress must never become clickable
again merely because a nested module emits a state-change
notification.

Interactive Stripe elements that complete later are tracked
separately from normal request/action busy state.
--------------------------------------------------
*/


import {
  createDiagnosticUi
} from "./ui.js";

import {
  createClerkAuth
} from "./clerkAuth.js";

import {
  createStripeCustomerFlow
} from "./stripeCustomer.js";

import {
  createStripeKycFlow
} from "./stripeKyc.js";

import {
  createDiagnosticSettlementFlow
} from "./diagnosticSettlement.js";

import {
  createStripeFundingFlow
} from "./stripeFunding.js";


/*
--------------------------------------------------
UI
--------------------------------------------------
*/

const ui =
  createDiagnosticUi();

ui.disableAllActions();

ui.setStatus(
  "Initializing Stripe diagnostic..."
);


/*
--------------------------------------------------
Shared flow state
--------------------------------------------------
*/

const state = {
  /*
  Stripe environment / SDK
  */

  browserConfig:
    null,

  onramp:
    null,


  /*
  Link / CryptoCustomer
  */

  authIntentId:
    null,

  cryptoCustomerId:
    null,


  /*
  Stripe verification state
  */

  stripeKycVerified:
    false,

  stripeDocumentVerificationStatus:
    null,

  stripeDocumentVerified:
    false,


  /*
  Diagnostic settlement
  */

  sandboxDiagnosticSettlementId:
    null,


  /*
  Transaction limits
  */

  achLimitsAvailable:
    false,

  transactionLimits:
    null,


  /*
  ACH payment method
  */

  cryptoPaymentToken:
    null,


  /*
  Headless Session / checkout
  */

  headlessSession:
    null,

  checkoutCompleted:
    false
};


/*
--------------------------------------------------
Orchestrator-local activity state

This is UI / orchestration state only.

It does NOT represent Stripe or settlement truth.
--------------------------------------------------
*/

const activity = {
  /*
  Normal synchronous / awaited action lock.

  Examples:
  - register
  - create_auth_intent
  - load_customer
  - transaction_limits
  - headless_session
  - checkout
  */

  activeAction:
    null,


  /*
  Stripe Link authentication element has been mounted
  and is waiting for the user's eventual callback.

  stripeCustomer.js exposes onSuccess, but abandoned /
  declined callbacks remain internal to that module.

  Therefore Authenticate stays disabled while this
  element is active. A new LinkAuthIntent may still be
  created to restart the authentication path.
  */

  authenticationElementMounted:
    false,


  /*
  ACH collection element has been mounted and is waiting
  for Stripe's callback.

  stripeFunding.js DOES emit onStateChange for every ACH
  callback outcome, so this lock can be released later.
  */

  achCollectionElementMounted:
    false,


  /*
  stripeFunding.collectAchPaymentMethod() emits:

  1. one state-change notification when it clears old
     payment-method state

  2. another notification when the Stripe callback fires

  Tracking notifications while the action is still being
  created protects against an unusually fast callback.
  */

  achCollectionNotificationCount:
    0
};


/*
--------------------------------------------------
Activity helpers
--------------------------------------------------
*/

function hasActiveAction() {
  return Boolean(
    activity.activeAction
  );
}


function isAchCollectionInteractive() {
  return (
    activity
      .achCollectionElementMounted ===
    true
  );
}


function canStartNormalAction() {
  return Boolean(
    !hasActiveAction() &&
    !isAchCollectionInteractive()
  );
}


function beginAction(
  actionName
) {
  if (
    !actionName ||
    hasActiveAction() ||
    isAchCollectionInteractive()
  ) {
    return false;
  }

  activity.activeAction =
    actionName;

  /*
  --------------------------------------------------
  Generic flow actions are locked by syncFlowUi().

  KYC is intentionally outside syncFlowUi(), so disable
  it explicitly while another orchestrated action runs.
  --------------------------------------------------
  */

  ui.setKycEnabled(
    false
  );

  syncFlowUi();

  return true;
}


function endAction(
  actionName
) {
  if (
    activity.activeAction ===
      actionName
  ) {
    activity.activeAction =
      null;
  }
}


/*
--------------------------------------------------
Reset hierarchy

Downstream state must never survive a change in an
upstream dependency.
--------------------------------------------------
*/

function resetCheckoutState() {
  state.headlessSession =
    null;

  state.checkoutCompleted =
    false;
}


function resetPaymentMethodState() {
  state.cryptoPaymentToken =
    null;

  /*
  --------------------------------------------------
  Any payment-method reset invalidates an older mounted
  ACH collection interaction.
  --------------------------------------------------
  */

  activity
    .achCollectionElementMounted =
    false;

  activity
    .achCollectionNotificationCount =
    0;

  resetCheckoutState();
}


function resetLimitsState() {
  state.achLimitsAvailable =
    false;

  state.transactionLimits =
    null;

  resetPaymentMethodState();
}


function resetStripeCustomerState() {
  state.cryptoCustomerId =
    null;

  state.stripeKycVerified =
    false;

  state
    .stripeDocumentVerificationStatus =
    null;

  state.stripeDocumentVerified =
    false;

  /*
  --------------------------------------------------
  A new customer/auth path invalidates any previously
  mounted Link authentication interaction.
  --------------------------------------------------
  */

  activity
    .authenticationElementMounted =
    false;

  resetLimitsState();
}


/*
--------------------------------------------------
Module references
--------------------------------------------------
*/

let clerkAuth =
  null;

let stripeCustomer =
  null;

let stripeKyc =
  null;

let diagnosticSettlement =
  null;

let stripeFunding =
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


/*
--------------------------------------------------
Derived flow guards
--------------------------------------------------
*/

function canRegisterLinkUser() {
  return Boolean(
    canStartNormalAction() &&
    isSandboxMode()
  );
}


function canCreateAuthIntent() {
  return Boolean(
    canStartNormalAction() &&
    state.browserConfig
  );
}


function canAuthenticate() {
  return Boolean(
    canStartNormalAction() &&
    state.authIntentId &&
    !state.cryptoCustomerId &&
    activity
      .authenticationElementMounted !==
      true
  );
}


function canLoadCustomerContext() {
  return Boolean(
    canStartNormalAction() &&
    state.authIntentId &&
    state.cryptoCustomerId
  );
}


function canLoadTransactionLimits() {
  if (
    !canStartNormalAction() ||
    !state.authIntentId ||
    !state.cryptoCustomerId ||
    state.stripeKycVerified !==
      true ||
    state.stripeDocumentVerified !==
      true
  ) {
    return false;
  }

  /*
  --------------------------------------------------
  Sandbox settlement is created lazily by the limits
  action itself.

  Live diagnostic requires an explicit settlement ID.
  --------------------------------------------------
  */

  if (
    isSandboxMode()
  ) {
    return true;
  }

  if (
    isLiveMode()
  ) {
    return Boolean(
      diagnosticSettlement
        ?.resolveDiagnosticSettlementId()
    );
  }

  return false;
}


function canCollectAch() {
  return Boolean(
    canStartNormalAction() &&
    isSandboxMode() &&
    state.stripeKycVerified ===
      true &&
    state.stripeDocumentVerified ===
      true &&
    state.achLimitsAvailable ===
      true &&
    !state.cryptoPaymentToken
  );
}


function canCreateHeadlessSession() {
  return Boolean(
    canStartNormalAction() &&
    isSandboxMode() &&
    state.stripeKycVerified ===
      true &&
    state.stripeDocumentVerified ===
      true &&
    state.achLimitsAvailable ===
      true &&
    state.cryptoPaymentToken &&
    state.sandboxDiagnosticSettlementId &&
    !state.headlessSession
  );
}


function canPerformCheckout() {
  return Boolean(
    canStartNormalAction() &&
    isSandboxMode() &&
    state.headlessSession?.sessionId &&
    state.headlessSession?.clientSecret &&
    state.checkoutCompleted !==
      true
  );
}


function canStartDocumentVerification() {
  return Boolean(
    canStartNormalAction() &&
    isSandboxMode() &&
    state.cryptoCustomerId &&
    state.stripeKycVerified ===
      true &&
    state.stripeDocumentVerified !==
      true &&
    String(
      state
        .stripeDocumentVerificationStatus ??
      ""
    )
      .trim()
      .toLowerCase() ===
      "not_started"
  );
}


/*
--------------------------------------------------
Flow UI synchronization

CRITICAL:

This function intentionally does NOT touch KYC.

Every regular button guard includes orchestrator activity
state, so nested module notifications cannot re-enable an
action while its request is still running.
--------------------------------------------------
*/

function syncFlowUi() {
  ui.setRegisterEnabled(
    canRegisterLinkUser()
  );

  ui.setAuthIntentEnabled(
    canCreateAuthIntent()
  );

  ui.setAuthenticateEnabled(
    canAuthenticate()
  );

  ui.setCustomerContextEnabled(
    canLoadCustomerContext()
  );

  ui.setTransactionLimitsEnabled(
    canLoadTransactionLimits()
  );

  ui.setAchEnabled(
    canCollectAch()
  );

  ui.setHeadlessSessionEnabled(
    canCreateHeadlessSession()
  );

  ui.setCheckoutEnabled(
    canPerformCheckout()
  );
}


/*
--------------------------------------------------
KYC UI synchronization

Only call when current CryptoCustomer verification state
is known/reconciled, or after a KYC action failed before
a successful mutation completed.

Never call this from generic funding notifications.
--------------------------------------------------
*/

function syncKycUi() {
  if (
    hasActiveAction() ||
    isAchCollectionInteractive()
  ) {
    ui.setKycEnabled(
      false
    );

    return;
  }

  ui.syncKycActionButton({
    cryptoCustomerId:
      state.cryptoCustomerId,

    stripeKycVerified:
      state.stripeKycVerified,

    stripeDocumentVerified:
      state.stripeDocumentVerified,

    stripeDocumentVerificationStatus:
      state
        .stripeDocumentVerificationStatus,

    sandbox:
      isSandboxMode(),

    canStartDocumentVerification:
      canStartDocumentVerification()
  });
}


/*
--------------------------------------------------
Funding state-change bridge

stripeFunding.js may notify while an awaited funding
operation is still running.

syncFlowUi() is safe because activeAction keeps those
buttons disabled.

ACH is special:

After the payment element has been mounted, the NEXT
funding notification represents its Stripe callback
(success / abandoned / error / unknown).

At that point the interactive lock can be released.
--------------------------------------------------
*/

function handleFundingStateChange() {
  if (
    activity.activeAction ===
      "collect_ach"
  ) {
    activity
      .achCollectionNotificationCount +=
      1;
  } else if (
    activity
      .achCollectionElementMounted ===
      true
  ) {
    activity
      .achCollectionElementMounted =
      false;
  }

  syncFlowUi();
}


/*
--------------------------------------------------
Safe error projection

Never dump whole Error objects because HTTP errors may
carry response payloads.

Never expose:
- client_secret
- cryptoPaymentToken
- Clerk bearer
--------------------------------------------------
*/

function getSafeErrorDetails(
  error
) {
  return {
    message:
      error?.message ??
      String(
        error
      ),

    status:
      Number.isFinite(
        Number(
          error?.status
        )
      )
        ? Number(
            error.status
          )
        : null
  };
}


function reportActionError(
  action,
  error
) {
  const details =
    getSafeErrorDetails(
      error
    );

  console.error(
    "STRIPE_DIAGNOSTIC_ACTION_FAILED",
    {
      action,
      ...details
    }
  );

  ui.setStatus(
    `${action} failed.`,
    details
  );
}


/*
--------------------------------------------------
Register Link user
--------------------------------------------------
*/

async function handleRegister() {
  const actionName =
    "register_link_user";

  if (
    !beginAction(
      actionName
    )
  ) {
    return;
  }

  activity
    .authenticationElementMounted =
    false;

  ui.clearStripeContainer();

  try {
    await stripeCustomer
      .registerLinkUser();
  } catch (
    error
  ) {
    reportActionError(
      "Register Link user",
      error
    );
  } finally {
    endAction(
      actionName
    );

    /*
    --------------------------------------------------
    Registration establishes a fresh identity path.

    KYC remains disabled until authentication and an
    authoritative CryptoCustomer load occur.
    --------------------------------------------------
    */

    ui.setKycEnabled(
      false
    );

    syncFlowUi();
  }
}


/*
--------------------------------------------------
Create LinkAuthIntent
--------------------------------------------------
*/

async function handleCreateAuthIntent() {
  const actionName =
    "create_auth_intent";

  if (
    !beginAction(
      actionName
    )
  ) {
    return;
  }

  /*
  --------------------------------------------------
  A newly requested auth intent supersedes any mounted
  authentication element from the previous attempt.
  --------------------------------------------------
  */

  activity
    .authenticationElementMounted =
    false;

  ui.clearStripeContainer();

  try {
    await stripeCustomer
      .createLinkAuthIntent();
  } catch (
    error
  ) {
    reportActionError(
      "Create LinkAuthIntent",
      error
    );
  } finally {
    endAction(
      actionName
    );

    /*
    --------------------------------------------------
    Do not project KYC here.

    A new successful auth intent has no reconciled
    CryptoCustomer yet.
    --------------------------------------------------
    */

    ui.setKycEnabled(
      false
    );

    syncFlowUi();
  }
}


/*
--------------------------------------------------
Authenticate Link user

authenticate() returns the mounted Stripe element before
the eventual user result callback.

Therefore:

- activeAction protects element creation itself
- authenticationElementMounted protects against a second
  Authenticate click afterward
- onSuccess releases the mounted-state marker and enables
  the CryptoCustomer action

If the user abandons/declines, Authenticate remains
disabled for that mounted attempt, but Create LinkAuthIntent
remains available to start a clean retry.
--------------------------------------------------
*/

async function handleAuthenticate() {
  const actionName =
    "authenticate";

  if (
    !beginAction(
      actionName
    )
  ) {
    return;
  }

  activity
    .authenticationElementMounted =
    false;

  let authenticationElement =
    null;

  try {
    authenticationElement =
      await stripeCustomer
        .authenticateLinkUser({
          onSuccess:
            async () => {
              activity
                .authenticationElementMounted =
                false;

              /*
              --------------------------------------------------
              CryptoCustomer exists now, but KYC/L2 state has
              not yet been reconciled.

              Keep KYC disabled until explicit customer reload.
              --------------------------------------------------
              */

              ui.setKycEnabled(
                false
              );

              syncFlowUi();
            }
        });

    /*
    --------------------------------------------------
    If authentication already completed synchronously,
    cryptoCustomerId is present and no mounted lock is
    needed.

    Otherwise the returned Stripe element represents an
    in-progress user interaction.
    --------------------------------------------------
    */

    activity
      .authenticationElementMounted =
      Boolean(
        authenticationElement &&
        !state.cryptoCustomerId
      );
  } catch (
    error
  ) {
    activity
      .authenticationElementMounted =
      false;

    reportActionError(
      "Authenticate Link user",
      error
    );
  } finally {
    endAction(
      actionName
    );

    ui.setKycEnabled(
      false
    );

    syncFlowUi();
  }
}


/*
--------------------------------------------------
Load / reload CryptoCustomer

This is the authoritative reconciliation point for:

- stripeKycVerified
- stripeDocumentVerificationStatus
- stripeDocumentVerified

Only SUCCESS may synchronize KYC projection.
--------------------------------------------------
*/

async function handleLoadCustomerContext() {
  const actionName =
    "load_customer_context";

  if (
    !beginAction(
      actionName
    )
  ) {
    return;
  }

  let customerLoaded =
    false;

  try {
    await stripeCustomer
      .loadCustomerContext();

    customerLoaded =
      true;
  } catch (
    error
  ) {
    reportActionError(
      "Load CryptoCustomer",
      error
    );
  } finally {
    endAction(
      actionName
    );

    syncFlowUi();

    if (
      customerLoaded
    ) {
      syncKycUi();
    } else {
      /*
      --------------------------------------------------
      Never re-enable KYC from stale verification state
      after failed reconciliation.
      --------------------------------------------------
      */

      ui.setKycEnabled(
        false
      );
    }
  }
}


/*
--------------------------------------------------
KYC action

One button represents:

1. basic Stripe KYC
2. L2 document verification

Success:
→ keep KYC disabled
→ require CryptoCustomer reload

Failure:
→ restore KYC projection from last reconciled state
--------------------------------------------------
*/

async function handleKyc() {
  const actionName =
    "kyc";

  if (
    !beginAction(
      actionName
    )
  ) {
    return;
  }

  let actionCompleted =
    false;

  let operation =
    null;

  try {
    if (
      state.stripeKycVerified !==
        true
    ) {
      operation =
        "basic_kyc";

      await stripeKyc
        .submitBasicKyc();

      actionCompleted =
        true;

      ui.setStatus(
        "Stripe KYC submission completed. Reload CryptoCustomer to reconcile Stripe verification state."
      );

      return;
    }

    /*
    --------------------------------------------------
    Do not call canStartDocumentVerification() here while
    activeAction === "kyc", because that guard correctly
    returns false while an action lock is held.

    Evaluate the reconciled document facts directly.
    --------------------------------------------------
    */

    const documentVerificationStartable =
      Boolean(
        isSandboxMode() &&
        state.cryptoCustomerId &&
        state.stripeKycVerified ===
          true &&
        state.stripeDocumentVerified !==
          true &&
        String(
          state
            .stripeDocumentVerificationStatus ??
          ""
        )
          .trim()
          .toLowerCase() ===
          "not_started"
      );

    if (
      documentVerificationStartable
    ) {
      operation =
        "l2_document_verification";

      await stripeKyc
        .verifyDocuments();

      actionCompleted =
        true;

      ui.setStatus(
        "Stripe L2 document-verification flow completed. Reload CryptoCustomer to confirm photo ID + selfie verification state."
      );

      return;
    }

    throw new Error(
      "stripe_kyc_action_not_available"
    );
  } catch (
    error
  ) {
    reportActionError(
      operation ===
        "l2_document_verification"
        ? "Stripe L2 document verification"
        : "Submit Stripe KYC",
      error
    );
  } finally {
    endAction(
      actionName
    );

    syncFlowUi();

    /*
    --------------------------------------------------
    CRITICAL KYC RULE

    Success:
    → remain disabled until CryptoCustomer reload.

    Failure:
    → retry may be projected from current reconciled state.
    --------------------------------------------------
    */

    if (
      actionCompleted
    ) {
      ui.setKycEnabled(
        false
      );
    } else {
      syncKycUi();
    }
  }
}


/*
--------------------------------------------------
Transaction limits
--------------------------------------------------
*/

async function handleTransactionLimits() {
  const actionName =
    "transaction_limits";

  if (
    !beginAction(
      actionName
    )
  ) {
    return;
  }

  try {
    await stripeFunding
      .loadTransactionLimits();
  } catch (
    error
  ) {
    reportActionError(
      "Load Stripe ACH transaction limits",
      error
    );
  } finally {
    endAction(
      actionName
    );

    /*
    --------------------------------------------------
    Internal funding notifications cannot re-enable the
    limits button while activeAction is held.

    Never sync KYC here.
    --------------------------------------------------
    */

    syncFlowUi();
  }
}


/*
--------------------------------------------------
ACH payment method

Two phases:

1. create / mount Stripe element
   protected by activeAction

2. user interaction with mounted element
   protected by achCollectionElementMounted

When the Stripe callback later fires, stripeFunding emits
onStateChange and handleFundingStateChange() releases the
mounted interaction lock.
--------------------------------------------------
*/

async function handleCollectAch() {
  const actionName =
    "collect_ach";

  if (
    !beginAction(
      actionName
    )
  ) {
    return;
  }

  activity
    .achCollectionElementMounted =
    false;

  activity
    .achCollectionNotificationCount =
    0;

  let paymentElement =
    null;

  let actionFailed =
    false;

  try {
    paymentElement =
      await stripeFunding
        .collectAchPaymentMethod();
  } catch (
    error
  ) {
    actionFailed =
      true;

    reportActionError(
      "Collect ACH payment method",
      error
    );
  } finally {
    /*
    --------------------------------------------------
    During a normal collectPaymentMethod() startup,
    stripeFunding emits one notification while clearing
    old payment state.

    If more than one notification was observed before the
    function returned, the callback already fired.

    cryptoPaymentToken is an additional success signal.
    --------------------------------------------------
    */

    const callbackAlreadyObserved =
      Boolean(
        state.cryptoPaymentToken
      ) ||
      activity
        .achCollectionNotificationCount >
        1;

    endAction(
      actionName
    );

    activity
      .achCollectionElementMounted =
      Boolean(
        !actionFailed &&
        paymentElement &&
        !callbackAlreadyObserved
      );

    syncFlowUi();
  }
}


/*
--------------------------------------------------
Headless Session
--------------------------------------------------
*/

async function handleCreateHeadlessSession() {
  const actionName =
    "headless_session";

  if (
    !beginAction(
      actionName
    )
  ) {
    return;
  }

  try {
    await stripeFunding
      .createHeadlessSession();
  } catch (
    error
  ) {
    reportActionError(
      "Create ACH Headless Session",
      error
    );
  } finally {
    endAction(
      actionName
    );

    syncFlowUi();
  }
}


/*
--------------------------------------------------
Checkout
--------------------------------------------------
*/

async function handleCheckout() {
  const actionName =
    "checkout";

  if (
    !beginAction(
      actionName
    )
  ) {
    return;
  }

  try {
    await stripeFunding
      .performCheckout();
  } catch (
    error
  ) {
    reportActionError(
      "Perform Stripe ACH checkout",
      error
    );
  } finally {
    endAction(
      actionName
    );

    syncFlowUi();
  }
}


/*
--------------------------------------------------
Event wiring
--------------------------------------------------
*/

function bindEvents() {
  ui.onRegister(
    handleRegister
  );

  ui.onCreateAuthIntent(
    handleCreateAuthIntent
  );

  ui.onAuthenticate(
    handleAuthenticate
  );

  ui.onLoadCustomerContext(
    handleLoadCustomerContext
  );

  ui.onKyc(
    handleKyc
  );

  ui.onTransactionLimits(
    handleTransactionLimits
  );

  ui.onCollectAch(
    handleCollectAch
  );

  ui.onCreateHeadlessSession(
    handleCreateHeadlessSession
  );

  ui.onCheckout(
    handleCheckout
  );
}


/*
--------------------------------------------------
Bootstrap
--------------------------------------------------
*/

async function bootstrap() {
  /*
  --------------------------------------------------
  Stripe customer / environment layer
  --------------------------------------------------
  */

  stripeCustomer =
    createStripeCustomerFlow({
      state,
      ui,
      resetStripeCustomerState,
      resetLimitsState
    });

  await stripeCustomer
    .loadBrowserConfig();


  /*
  --------------------------------------------------
  Bind one exact Clerk session
  --------------------------------------------------
  */

  clerkAuth =
    await createClerkAuth();


  /*
  --------------------------------------------------
  Settlement layer
  --------------------------------------------------
  */

  diagnosticSettlement =
    createDiagnosticSettlementFlow({
      state,
      ui,

      getAuthenticatedJsonHeaders:
        clerkAuth
          .buildAuthenticatedJsonHeaders
    });


  /*
  --------------------------------------------------
  KYC layer
  --------------------------------------------------
  */

  stripeKyc =
    createStripeKycFlow({
      state,
      ui,

      ensureSdk:
        stripeCustomer.ensureSdk,

      resetLimitsState
    });


  /*
  --------------------------------------------------
  Funding layer

  IMPORTANT:

  Funding state changes go through the orchestrator bridge,
  NOT directly to syncFlowUi().

  This preserves request/action locks and handles the ACH
  mounted-element lifecycle.
  --------------------------------------------------
  */

  stripeFunding =
    createStripeFundingFlow({
      state,
      ui,

      ensureSdk:
        stripeCustomer.ensureSdk,

      getAuthenticatedJsonHeaders:
        clerkAuth
          .buildAuthenticatedJsonHeaders,

      ensureSandboxDiagnosticSettlement:
        diagnosticSettlement
          .ensureSandboxDiagnosticSettlement,

      requireDiagnosticSettlementId:
        diagnosticSettlement
          .requireDiagnosticSettlementId,

      resolveDiagnosticSettlementId:
        diagnosticSettlement
          .resolveDiagnosticSettlementId,

      resetPaymentMethodState,
      resetCheckoutState,

      onStateChange:
        handleFundingStateChange
    });


  /*
  --------------------------------------------------
  Bind only after every module contract exists
  --------------------------------------------------
  */

  bindEvents();


  /*
  --------------------------------------------------
  Initial UI
  --------------------------------------------------
  */

  syncFlowUi();

  ui.setKycEnabled(
    false
  );


  /*
  --------------------------------------------------
  Safe startup projection
  --------------------------------------------------
  */

  const liveSettlementId =
    isLiveMode()
      ? diagnosticSettlement
          .resolveDiagnosticSettlementId()
      : null;

  ui.setStatus(
    "Stripe diagnostic ready.",
    {
      mode:
        state.browserConfig?.mode ??
        null,

      sandbox:
        isSandboxMode(),

      clerkSessionBound:
        true,

      settlementPolicy:
        isSandboxMode()
          ? "Fresh authenticated diagnostic settlement will be created server-side when transaction limits are requested."
          : liveSettlementId
            ? "Using explicit live diagnostic settlement from URL."
            : "Live diagnostic requires settlementId in the URL before transaction limits can be requested.",

      settlementId:
        liveSettlementId
    }
  );
}


/*
--------------------------------------------------
Fatal bootstrap failure
--------------------------------------------------
*/

bootstrap()
  .catch(
    (
      error
    ) => {
      activity.activeAction =
        null;

      activity
        .authenticationElementMounted =
        false;

      activity
        .achCollectionElementMounted =
        false;

      ui.disableAllActions();

      const details =
        getSafeErrorDetails(
          error
        );

      console.error(
        "STRIPE_DIAGNOSTIC_BOOTSTRAP_FAILED",
        details
      );

      ui.setStatus(
        "Stripe diagnostic initialization failed.",
        details
      );
    }
  );
