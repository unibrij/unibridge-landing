// unibridge-landing/surface/js/stripe-link-test/diagnosticSettlement.js

/*
--------------------------------------------------
Stripe diagnostic — settlement layer

Owns ONLY:

- resolving the diagnostic settlement ID
- sandbox-vs-live settlement-ID policy
- creating the authenticated sandbox diagnostic settlement
- memoizing sandbox settlement creation
- reflecting generated sandbox settlement ID in the URL

Does NOT own:

- Clerk session/token logic
- Stripe SDK
- Link authentication
- CryptoCustomer
- KYC
- transaction limits
- ACH collection
- Headless Session
- checkout
- flow-button policy

Settlement policy:

Sandbox:
- settlementId from URL is NEVER authoritative
- a fresh authenticated diagnostic settlement is created
  server-side on demand
- browser supplies no canonical funding facts

Live diagnostic:
- no settlement is created here
- an explicit settlementId from the URL is required

Authenticated sandbox endpoint:

POST /v2/ramp/stripe/browser/test-settlement
--------------------------------------------------
*/


/*
--------------------------------------------------
Constants
--------------------------------------------------
*/

const SANDBOX_TEST_SETTLEMENT_URL =
  "/v2/ramp/stripe/browser/test-settlement";


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


function createHttpError(
  response,
  payload,
  fallbackCode
) {
  const error =
    new Error(
      payload?.error?.message ||
      payload?.message ||
      fallbackCode
    );

  error.status =
    response?.status ??
    null;

  error.payload =
    payload ??
    null;

  return error;
}


/*
--------------------------------------------------
Factory
--------------------------------------------------
*/

export function createDiagnosticSettlementFlow({
  state,
  ui,
  getAuthenticatedJsonHeaders
} = {}) {
  if (
    !state ||
    typeof state !==
      "object"
  ) {
    throw new Error(
      "diagnostic_settlement_state_required"
    );
  }

  if (
    !ui ||
    typeof ui !==
      "object"
  ) {
    throw new Error(
      "diagnostic_settlement_ui_required"
    );
  }

  if (
    typeof getAuthenticatedJsonHeaders !==
      "function"
  ) {
    throw new Error(
      "diagnostic_settlement_auth_headers_required"
    );
  }


  /*
  --------------------------------------------------
  Local in-flight state

  The promise is implementation state and does not belong
  in the shared flow state.

  This prevents duplicate settlement creation when the
  same action is triggered concurrently.
  --------------------------------------------------
  */

  let sandboxDiagnosticSettlementPromise =
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


  function requireSandboxMode(
    code =
      "sandbox_test_settlement_disabled_in_live_mode"
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
  URL settlement

  Used ONLY in live safe-diagnostic mode.

  Sandbox intentionally ignores this value even if the
  URL contains a settlementId from a previous run.
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
  → only state.sandboxDiagnosticSettlementId

  Live:
  → explicit URL settlement
  --------------------------------------------------
  */

  function resolveDiagnosticSettlementId() {
    if (
      isSandboxMode()
    ) {
      return (
        normalizeOptionalString(
          state
            .sandboxDiagnosticSettlementId
        )
      );
    }

    if (
      isLiveMode()
    ) {
      return resolveUrlDiagnosticSettlementId();
    }

    return null;
  }


  function requireDiagnosticSettlementId() {
    return requireString(
      resolveDiagnosticSettlementId(),
      "missing_diagnostic_settlement_id"
    );
  }


  /*
  --------------------------------------------------
  Remember sandbox diagnostic settlement

  Shared state owns the actual settlement ID because the
  funding layer needs the same ID later for:

  - transaction limits
  - ACH Headless Session
  - checkout lifecycle

  The URL is updated only for visibility/debugging.

  A future page reload in sandbox still ignores that URL
  value and creates a new authenticated diagnostic
  settlement on demand.
  --------------------------------------------------
  */

  function rememberSandboxDiagnosticSettlementId(
    settlementId
  ) {
    requireSandboxMode();

    const normalizedSettlementId =
      requireString(
        settlementId,
        "missing_sandbox_diagnostic_settlement_id"
      );

    state.sandboxDiagnosticSettlementId =
      normalizedSettlementId;

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


  /*
  --------------------------------------------------
  Create sandbox diagnostic settlement

  Security / ownership rules:

  - Clerk bearer comes from clerkAuth.js.
  - Backend resolves the current UniBridge customer.
  - Browser sends an EMPTY body.
  - Browser sends no amount.
  - Browser sends no wallet.
  - Browser sends no network.
  - Browser sends no currency.
  - Backend owns all canonical diagnostic funding facts.
  --------------------------------------------------
  */

  async function createSandboxDiagnosticSettlement() {
    requireSandboxMode();

    const headers =
      await getAuthenticatedJsonHeaders();

    ui.setStatus(
      "Creating clean US sandbox diagnostic settlement...",
      {
        mode:
          state.browserConfig?.mode ??
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
      throw createHttpError(
        response,
        payload,
        `sandbox_test_settlement_http_${response.status}`
      );
    }

    if (
      payload?.ok !==
        true
    ) {
      const error =
        new Error(
          "sandbox_test_settlement_not_ok"
        );

      error.payload =
        payload ??
        null;

      throw error;
    }

    if (
      payload?.diagnostic_only !==
        true
    ) {
      const error =
        new Error(
          "sandbox_test_settlement_not_diagnostic"
        );

      error.payload =
        payload ??
        null;

      throw error;
    }

    const settlementId =
      rememberSandboxDiagnosticSettlementId(
        payload?.settlement_id
      );

    /*
    --------------------------------------------------
    Provider guard

    This endpoint exists specifically for the
    stripe_onramp diagnostic path.

    Fail closed if a future backend change accidentally
    returns another provider.
    --------------------------------------------------
    */

    const provider =
      normalizeOptionalString(
        payload?.provider
      )
        ?.toLowerCase() ??
      null;

    if (
      provider !==
        "stripe_onramp"
    ) {
      state.sandboxDiagnosticSettlementId =
        null;

      throw new Error(
        "sandbox_test_settlement_provider_mismatch"
      );
    }

    console.log(
      "STRIPE_SANDBOX_TEST_SETTLEMENT_READY",
      {
        settlement_id:
          settlementId,

        provider,

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


  /*
  --------------------------------------------------
  Ensure one sandbox diagnostic settlement per current
  page flow.

  Existing ID:
  → reuse it

  Creation already in flight:
  → await the same promise

  Creation failure:
  → clear both ID and promise so retry is possible
  --------------------------------------------------
  */

  async function ensureSandboxDiagnosticSettlement() {
    requireSandboxMode();

    const existingSettlementId =
      normalizeOptionalString(
        state
          .sandboxDiagnosticSettlementId
      );

    if (
      existingSettlementId
    ) {
      return existingSettlementId;
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
            state.sandboxDiagnosticSettlementId =
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


  /*
  --------------------------------------------------
  Public contract
  --------------------------------------------------
  */

  return {
    resolveDiagnosticSettlementId,
    requireDiagnosticSettlementId,
    ensureSandboxDiagnosticSettlement
  };
}
