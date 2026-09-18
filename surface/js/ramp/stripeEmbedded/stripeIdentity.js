// unibrij/unibridge-landing/surface/js/ramp/stripeEmbedded/stripeIdentity.js

import {
  createStripeLinkAuthIntent,
  startStripeCustomerAuthentication,
  loadStripeCryptoCustomer,
  getStripeVerificationStatus,
  isStripeVerificationVerified
} from "./stripeCustomer.js";


let stripeKycModule = null;


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


function assertFlowActive(
  assertActive
) {
  if (
    typeof assertActive ===
      "function"
  ) {
    assertActive();
  }
}


/*
--------------------------------------------------
Stripe KYC module

Keep KYC provider UI/runtime lazy.

The browser module loader already caches the module;
this local reference is retained only so reset() can
reach an already-loaded KYC flow without loading it
solely for cleanup.
--------------------------------------------------
*/

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


/*
--------------------------------------------------
Reset identity UI state

If Stripe KYC has never been loaded, there is no KYC
state here to reset.
--------------------------------------------------
*/

export function resetStripeIdentityFlow() {
  try {
    stripeKycModule
      ?.resetStripeKycFlow?.();
  } catch (
    error
  ) {
    console.warn(
      "STRIPE_KYC_RESET_FAILED",
      error
    );
  }
}


/*
--------------------------------------------------
Authenticated UniBridge email

Clerk remains the authenticated source for the email
used to initialize Stripe Link authentication.

This function does not establish reusable identity
ownership. Backend customer context remains
authoritative for settlement operations.
--------------------------------------------------
*/

export async function resolveAuthenticatedStripeEmail() {
  const {
    ensureFiatClerkAuth
  } =
    await import(
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


/*
--------------------------------------------------
Load current CryptoCustomer

Every reload uses the same:

LinkAuthIntent
  ↔ CryptoCustomer

relationship.

The backend independently verifies this relationship
again before sensitive Headless operations.
--------------------------------------------------
*/

async function loadCryptoCustomer({
  authIntentId,
  cryptoCustomerId,
  assertActive
}) {
  const customer =
    await loadStripeCryptoCustomer({
      authIntentId,
      cryptoCustomerId
    });

  assertFlowActive(
    assertActive
  );

  return customer;
}


/*
--------------------------------------------------
Stripe Link authentication

Creates the LinkAuthIntent, mounts Stripe's
authentication element, waits for completion and
returns the resulting correlation identifiers.
--------------------------------------------------
*/

async function authenticateStripeCustomer({
  sdk,
  container,
  email,
  setStatus,
  assertActive
}) {
  if (
    !sdk
  ) {
    throw new Error(
      "stripe_sdk_missing"
    );
  }

  if (
    !container ||
    typeof container.replaceChildren !==
      "function"
  ) {
    throw new Error(
      "stripe_identity_container_invalid"
    );
  }

  if (
    typeof setStatus !==
      "function"
  ) {
    throw new Error(
      "stripe_identity_status_handler_missing"
    );
  }

  const normalizedEmail =
    requireString(
      email,
      "authenticated_customer_email_missing"
    )
      .toLowerCase();


  assertFlowActive(
    assertActive
  );

  setStatus(
    "Starting secure Stripe authentication..."
  );


  const {
    authIntentId
  } =
    await createStripeLinkAuthIntent({
      email:
        normalizedEmail
    });


  assertFlowActive(
    assertActive
  );


  const authentication =
    await startStripeCustomerAuthentication({
      sdk,

      authIntentId
    });


  assertFlowActive(
    assertActive
  );


  if (
    !authentication?.element ||
    !authentication?.completion
  ) {
    throw new Error(
      "stripe_customer_authentication_invalid"
    );
  }


  container.replaceChildren(
    authentication.element
  );

  setStatus(
    "Complete Stripe authentication to continue."
  );


  const completed =
    await authentication.completion;


  assertFlowActive(
    assertActive
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


/*
--------------------------------------------------
Stripe KYC + L2

ACH requires:

kyc_verified = verified
id_document_verified = verified

Basic KYC alone is not enough.

The CryptoCustomer is reloaded after each interactive
verification stage before any final funding decision
is made.
--------------------------------------------------
*/

async function verifyStripeIdentity({
  sdk,
  authIntentId,
  cryptoCustomerId,
  setStatus,
  assertActive
}) {
  const kycModule =
    await ensureStripeKycModule();

  const runStripeKycFlow =
    kycModule
      ?.runStripeKycFlow;

  if (
    typeof runStripeKycFlow !==
      "function"
  ) {
    throw new Error(
      "stripe_kyc_runtime_missing"
    );
  }


  assertFlowActive(
    assertActive
  );


  let customer =
    await loadCryptoCustomer({
      authIntentId,
      cryptoCustomerId,
      assertActive
    });


  /*
  --------------------------------------------------
  Basic Stripe KYC
  --------------------------------------------------
  */

  if (
    !isStripeVerificationVerified(
      customer,
      "kyc_verified"
    )
  ) {
    setStatus(
      "Complete Stripe identity verification."
    );

    await runStripeKycFlow({
      sdk,

      includeUsStepUp:
        true,

      setStatus
    });


    assertFlowActive(
      assertActive
    );


    customer =
      await loadCryptoCustomer({
        authIntentId,
        cryptoCustomerId,
        assertActive
      });
  }


  /*
  --------------------------------------------------
  Basic KYC gate

  Do not continue to ACH L2 unless the reloaded
  CryptoCustomer confirms basic KYC.
  --------------------------------------------------
  */

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


  /*
  --------------------------------------------------
  Stripe L2 document/selfie verification
  --------------------------------------------------
  */

  let documentStatus =
    getStripeVerificationStatus(
      customer,
      "id_document_verified"
    );


  if (
    documentStatus ===
      "not_started"
  ) {
    if (
      typeof sdk.verifyDocuments !==
        "function"
    ) {
      throw new Error(
        "stripe_verify_documents_not_available"
      );
    }


    setStatus(
      "Stripe needs a photo ID and selfie to continue."
    );


    await sdk.verifyDocuments();


    assertFlowActive(
      assertActive
    );


    customer =
      await loadCryptoCustomer({
        authIntentId,
        cryptoCustomerId,
        assertActive
      });


    documentStatus =
      getStripeVerificationStatus(
        customer,
        "id_document_verified"
      );
  }


  /*
  --------------------------------------------------
  Final ACH identity gate

  No ConsumerWallet registration, transaction-limit
  request, ACH collection or Headless session may run
  unless both checks are verified on the final loaded
  CryptoCustomer.
  --------------------------------------------------
  */

  const kycVerified =
    isStripeVerificationVerified(
      customer,
      "kyc_verified"
    );

  const documentVerified =
    isStripeVerificationVerified(
      customer,
      "id_document_verified"
    );


  if (
    !kycVerified ||
    !documentVerified
  ) {
    const error =
      new Error(
        "stripe_l2_not_verified"
      );

    error.verificationStatus =
      getStripeVerificationStatus(
        customer,
        "kyc_verified"
      );

    error.documentVerificationStatus =
      documentStatus ??
      getStripeVerificationStatus(
        customer,
        "id_document_verified"
      );

    throw error;
  }


  return {
    customer,

    kycStatus:
      getStripeVerificationStatus(
        customer,
        "kyc_verified"
      ),

    documentStatus:
      getStripeVerificationStatus(
        customer,
        "id_document_verified"
      )
  };
}


/*
--------------------------------------------------
Public identity stage

Owns the complete browser-side Stripe identity phase:

Clerk authenticated email
        ↓
LinkAuthIntent
        ↓
Stripe Link authentication
        ↓
CryptoCustomer
        ↓
Basic Stripe KYC
        ↓
L2 document/selfie verification
        ↓
verified identity context

It intentionally stops before:

- ConsumerWallet registration
- transaction limits
- payment-method collection
- Headless session creation
- checkout
--------------------------------------------------
*/

export async function runStripeIdentityStage({
  sdk,
  container,
  email,
  setStatus,
  assertActive = null
}) {
  assertFlowActive(
    assertActive
  );


  const {
    authIntentId,
    cryptoCustomerId
  } =
    await authenticateStripeCustomer({
      sdk,

      container,

      email,

      setStatus,

      assertActive
    });


  assertFlowActive(
    assertActive
  );


  const identity =
    await verifyStripeIdentity({
      sdk,

      authIntentId,

      cryptoCustomerId,

      setStatus,

      assertActive
    });


  assertFlowActive(
    assertActive
  );


  return {
    authIntentId,

    cryptoCustomerId,

    customer:
      identity.customer,

    kycStatus:
      identity.kycStatus,

    documentStatus:
      identity.documentStatus
  };
}
