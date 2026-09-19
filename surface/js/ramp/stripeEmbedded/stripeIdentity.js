// unibrij/unibridge-landing/surface/js/ramp/stripeEmbedded/stripeIdentity.js

import {
  createStripeLinkAuthIntent,
  startStripeCustomerAuthentication,
  loadStripeCryptoCustomer,
  getStripeVerificationStatus,
  isStripeVerificationVerified
} from "./stripeCustomer.js";


let stripeKycModule = null;


function requireString(value, errorCode) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    throw new Error(errorCode);
  }

  return normalized;
}


function assertFlowActive(assertActive) {
  if (typeof assertActive === "function") {
    assertActive();
  }
}


async function ensureStripeKycModule() {
  if (!stripeKycModule) {
    stripeKycModule = await import(
      "/surface/js/kyc/stripe/stripeKycFlow.js"
    );
  }

  return stripeKycModule;
}


export function resetStripeIdentityFlow() {
  try {
    stripeKycModule?.resetStripeKycFlow?.();
  } catch (error) {
    console.warn(
      "STRIPE_KYC_RESET_FAILED",
      error
    );
  }
}


export async function resolveAuthenticatedStripeEmail() {
  const {
    ensureFiatClerkAuth
  } = await import(
    "/shared/pay/auth/clerkAuth.js"
  );

  if (typeof ensureFiatClerkAuth !== "function") {
    throw new Error(
      "surface_customer_auth_unavailable"
    );
  }

  const auth = await ensureFiatClerkAuth();

  return requireString(
    auth?.email,
    "authenticated_customer_email_missing"
  ).toLowerCase();
}


async function loadCryptoCustomer({
  authIntentId,
  cryptoCustomerId,
  assertActive
}) {
  const customer = await loadStripeCryptoCustomer({
    authIntentId,
    cryptoCustomerId
  });

  assertFlowActive(assertActive);

  return customer;
}


async function authenticateStripeCustomer({
  sdk,
  container,
  email,
  setStatus,
  assertActive
}) {
  if (!sdk) {
    throw new Error(
      "stripe_sdk_missing"
    );
  }

  if (
    !container ||
    typeof container.replaceChildren !== "function"
  ) {
    throw new Error(
      "stripe_identity_container_invalid"
    );
  }

  if (typeof setStatus !== "function") {
    throw new Error(
      "stripe_identity_status_handler_missing"
    );
  }

  const normalizedEmail = requireString(
    email,
    "authenticated_customer_email_missing"
  ).toLowerCase();

  assertFlowActive(assertActive);

  setStatus(
    "Starting secure Stripe authentication..."
  );

  const {
    authIntentId
  } = await createStripeLinkAuthIntent({
    email: normalizedEmail
  });

  assertFlowActive(assertActive);

  const authentication =
    await startStripeCustomerAuthentication({
      sdk,
      authIntentId
    });

  assertFlowActive(assertActive);

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

  assertFlowActive(assertActive);

  container.replaceChildren();

  return {
    authIntentId: requireString(
      completed?.authIntentId ??
        authIntentId,
      "missing_auth_intent_id"
    ),

    cryptoCustomerId: requireString(
      completed?.cryptoCustomerId,
      "missing_crypto_customer_id"
    )
  };
}


/*
ACH identity requirement:

kyc_verified = verified
id_document_verified = verified

Reload CryptoCustomer after every interactive
verification step before making the final decision.
*/

async function verifyStripeIdentity({
  sdk,
  authIntentId,
  cryptoCustomerId,
  setStatus,
  assertActive
}) {
  let customer =
    await loadCryptoCustomer({
      authIntentId,
      cryptoCustomerId,
      assertActive
    });


  /*
  Basic KYC
  */

  if (
    !isStripeVerificationVerified(
      customer,
      "kyc_verified"
    )
  ) {
    const {
      runStripeKycFlow
    } = await ensureStripeKycModule();

    assertFlowActive(assertActive);

    if (
      typeof runStripeKycFlow !== "function"
    ) {
      throw new Error(
        "stripe_kyc_runtime_missing"
      );
    }

    setStatus(
      "Complete Stripe identity verification."
    );

    await runStripeKycFlow({
      sdk,
      includeUsStepUp: true,
      setStatus
    });

    assertFlowActive(assertActive);

    customer =
      await loadCryptoCustomer({
        authIntentId,
        cryptoCustomerId,
        assertActive
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


  /*
  ACH L2 document/selfie
  */

  let documentStatus =
    getStripeVerificationStatus(
      customer,
      "id_document_verified"
    );

  if (documentStatus === "not_started") {
    if (
      typeof sdk?.verifyDocuments !== "function"
    ) {
      throw new Error(
        "stripe_verify_documents_not_available"
      );
    }

    setStatus(
      "Stripe needs a photo ID and selfie to continue."
    );

    await sdk.verifyDocuments();

    assertFlowActive(assertActive);

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
  Final ACH identity gate
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
Public identity boundary:

Clerk email
→ Link authentication
→ CryptoCustomer
→ basic KYC
→ L2 document/selfie

Stops before wallet, limits, ACH collection
and Headless execution.
*/

export async function runStripeIdentityStage({
  sdk,
  container,
  email,
  setStatus,
  assertActive = null
}) {
  assertFlowActive(assertActive);

  const {
    authIntentId,
    cryptoCustomerId
  } = await authenticateStripeCustomer({
    sdk,
    container,
    email,
    setStatus,
    assertActive
  });

  assertFlowActive(assertActive);

  const identity =
    await verifyStripeIdentity({
      sdk,
      authIntentId,
      cryptoCustomerId,
      setStatus,
      assertActive
    });

  assertFlowActive(assertActive);

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
