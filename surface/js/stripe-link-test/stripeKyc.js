// unibridge-landing/surface/js/stripe-link-test/stripeKyc.js

/*
--------------------------------------------------
Stripe diagnostic — KYC / L2 layer

Owns ONLY:

- reading KYC form values from UI
- validating diagnostic KYC input
- building Stripe KYC payload
- submitting basic Stripe KYC
- starting Stripe L2 document verification

Does NOT own:

- Stripe browser config
- Stripe SDK initialization
- Link authentication
- CryptoCustomer loading
- verification-state reconciliation
- Clerk authentication
- diagnostic settlement
- transaction limits
- ACH collection
- Headless Session
- checkout
- button policy

Important:

- SSN goes browser → Stripe SDK directly.
- SSN is never sent to UniBridge backend.
- SSN is never logged.
- Successful submitKycInfo() does NOT mean verified.
- Successful verifyDocuments() does NOT mean L2 verified.
- CryptoCustomer must be reloaded afterward.
--------------------------------------------------
*/


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


/*
--------------------------------------------------
Factory
--------------------------------------------------
*/

export function createStripeKycFlow({
  state,
  ui,
  ensureSdk,
  resetLimitsState
} = {}) {
  if (
    !state ||
    typeof state !==
      "object"
  ) {
    throw new Error(
      "stripe_kyc_state_required"
    );
  }

  if (
    !ui ||
    typeof ui !==
      "object"
  ) {
    throw new Error(
      "stripe_kyc_ui_required"
    );
  }

  if (
    typeof ensureSdk !==
      "function"
  ) {
    throw new Error(
      "stripe_kyc_ensure_sdk_required"
    );
  }

  if (
    typeof resetLimitsState !==
      "function"
  ) {
    throw new Error(
      "stripe_kyc_reset_limits_state_required"
    );
  }


  /*
  --------------------------------------------------
  Mode guard

  Diagnostic KYC mutation is sandbox-only.

  Live diagnostic remains read-only for KYC.
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


  function requireSandboxMode(
    code =
      "stripe_kyc_sandbox_only"
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
  Build KYC payload

  UI owns only raw form reads.

  This module owns interpretation and validation.
  --------------------------------------------------
  */

  function buildKycInfo() {
    if (
      typeof ui.getKycValues !==
        "function"
    ) {
      throw new Error(
        "stripe_kyc_ui_reader_missing"
      );
    }

    const values =
      ui.getKycValues();


    /*
    --------------------------------------------------
    Date of birth
    --------------------------------------------------
    */

    const dob =
      requireString(
        values?.dateOfBirth,
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


    /*
    --------------------------------------------------
    US SSN

    Strip formatting characters.

    The raw value never leaves this module except in the
    direct Stripe SDK submitKycInfo() call.
    --------------------------------------------------
    */

    const ssn =
      requireString(
        values?.idNumber,
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


    /*
    --------------------------------------------------
    Stripe KYC payload
    --------------------------------------------------
    */

    return {
      given_name:
        requireString(
          values?.firstName,
          "missing_kyc_first_name"
        ),

      surname:
        requireString(
          values?.lastName,
          "missing_kyc_last_name"
        ),

      address: {
        line1:
          requireString(
            values?.addressLine1,
            "missing_kyc_address_line1"
          ),

        city:
          requireString(
            values?.city,
            "missing_kyc_city"
          ),

        state:
          requireString(
            values?.state,
            "missing_kyc_state"
          ),

        postal_code:
          requireString(
            values?.postalCode,
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


  /*
  --------------------------------------------------
  Submit basic Stripe KYC

  Important:

  SDK submission success means only that Stripe accepted
  the submission flow.

  It does NOT update:

  state.stripeKycVerified
  state.stripeDocumentVerified

  Those remain authoritative only after the next
  CryptoCustomer reload.
  --------------------------------------------------
  */

  async function submitBasicKyc() {
    requireSandboxMode(
      "stripe_kyc_disabled_in_live_mode"
    );

    requireString(
      state.cryptoCustomerId,
      "missing_crypto_customer_id"
    );

    if (
      state.stripeKycVerified ===
        true
    ) {
      throw new Error(
        "stripe_kyc_already_verified"
      );
    }

    const sdk =
      await ensureSdk();

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

    /*
    --------------------------------------------------
    Any previous limits/payment/headless state becomes
    stale once KYC mutation begins.
    --------------------------------------------------
    */

    resetLimitsState();

    ui.setStatus(
      "Submitting Stripe KYC..."
    );


    /*
    --------------------------------------------------
    Safe diagnostic log.

    Never log the SSN value.
    --------------------------------------------------
    */

    console.log(
      "STRIPE_KYC_INFO",
      {
        given_name:
          kycInfo.given_name,

        surname:
          kycInfo.surname,

        address: {
          ...kycInfo.address
        },

        date_of_birth: {
          ...kycInfo.date_of_birth
        },

        id_number: {
          type:
            kycInfo.id_number.type,

          value:
            "[REDACTED]"
        }
      }
    );


    /*
    --------------------------------------------------
    Direct browser → Stripe SDK submission.

    No UniBridge API request carries id_number.
    --------------------------------------------------
    */

    const result =
      await sdk.submitKycInfo(
        kycInfo
      );

    console.log(
      "STRIPE_SUBMIT_KYC_COMPLETE",
      {
        submitted:
          true
      }
    );

    return result;
  }


  /*
  --------------------------------------------------
  Start Stripe L2 document verification

  Current ACH requirement:

  kyc_verified = verified
  AND
  id_document_verified = verified

  Stripe L2 performs:
  - photo ID
  - selfie

  Starting/completing the SDK flow does NOT itself set
  local state to verified.

  Caller must reload CryptoCustomer afterward.
  --------------------------------------------------
  */

  async function verifyDocuments() {
    requireSandboxMode(
      "stripe_document_verification_disabled_in_live_mode"
    );

    requireString(
      state.cryptoCustomerId,
      "missing_crypto_customer_id"
    );

    if (
      state.stripeKycVerified !==
        true
    ) {
      throw new Error(
        "stripe_kyc_not_verified"
      );
    }

    if (
      state.stripeDocumentVerified ===
        true
    ) {
      throw new Error(
        "stripe_document_already_verified"
      );
    }

    const documentStatus =
      normalizeString(
        state
          .stripeDocumentVerificationStatus
      )
        .toLowerCase();

    if (
      documentStatus !==
        "not_started"
    ) {
      throw new Error(
        `stripe_document_verification_not_startable:${
          documentStatus ||
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

    /*
    --------------------------------------------------
    Verification mutation invalidates downstream state.
    --------------------------------------------------
    */

    resetLimitsState();

    ui.setStatus(
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


  /*
  --------------------------------------------------
  Public contract
  --------------------------------------------------
  */

  return {
    submitBasicKyc,
    verifyDocuments
  };
}
