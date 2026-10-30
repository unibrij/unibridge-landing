// unibridge-landing/api/proxy.js

import crypto from "crypto";

const API_BASE =
  process.env.UNIBRIDGE_API_BASE;

const SURFACE_SECRET =
  process.env.SURFACE_HMAC_SECRET;

const FIAT_BANK_TRANSFER_SECRET =
  process.env
    .FIAT_BANK_TRANSFER_HMAC_SECRET ||
  process.env.SURFACE_HMAC_SECRET;

const DEFAULT_UPSTREAM_TIMEOUT_MS =
  15000;

const SESSION_QUOTE_TIMEOUT_MS =
  70000;

const EXTHAND_TIMEOUT_MS =
  45000;

const EXTHAND_START_ENDPOINT =
  "fiat/connected-bank/exthand/start";

const EXTHAND_REFRESH_ENDPOINT =
  "fiat/connected-bank/exthand/refresh";

const EXTHAND_BANKS_ENDPOINT =
  "fiat/connected-bank/exthand/banks";

const EXTHAND_ENDPOINTS =
  new Set([
    EXTHAND_START_ENDPOINT,
    EXTHAND_REFRESH_ENDPOINT,
    EXTHAND_BANKS_ENDPOINT
  ]);

const ALLOWED =
  new Set([
    "account",

    "session/register",
    "fiat/session/register",
    "session/resolve",
    "session/quote",
    "settlement/create",
    "settlement/confirm",
    "funding/session",
    "settlement/status",

    /*
    --------------------------------------------------
    Fiat payout history
    --------------------------------------------------
    */

    "fiat/payout-history",

    /*
    --------------------------------------------------
    Fiat KYC
    --------------------------------------------------
    */

    "fiat/kyc/create",
    "fiat/kyc/shared/create",

    /*
    --------------------------------------------------
    Fiat bank-transfer / Bridge
    --------------------------------------------------
    */

    "fiat/bridge-tos/create",
    "fiat/bridge-customer/create",
    "fiat/bridge-bank-transfer/create",
    "fiat/bridge-tos/ping",

    /*
    --------------------------------------------------
    Fiat bank-transfer / Exthand PIS

    Trial: Fiat -> Bank Transfer only.
    --------------------------------------------------
    */

    EXTHAND_START_ENDPOINT,
    EXTHAND_REFRESH_ENDPOINT,
    EXTHAND_BANKS_ENDPOINT,

    /*
    --------------------------------------------------
    Fiat bank-transfer / Transak VBA
    --------------------------------------------------
    */

    "fiat/transak-virtual-account/create",

    /*
    --------------------------------------------------
    Shared payout options
    --------------------------------------------------
    */

    "options/corridors",
    "options/coinsph/ph-payout-channels",
    "options/elementpay/ng-banks",
    "options/ramp-source-availability",
    "options/executor-availability",

    /*
    --------------------------------------------------
    Receive
    --------------------------------------------------
    */

    "receive",
    "receive/events",
    "receive/pricing-preview",
    "receive/settlement/create",

    /*
    --------------------------------------------------
    Ramp orchestration
    --------------------------------------------------
    */

    "ramp/auth/start",
    "ramp/auth/verify",
    "ramp/user",
    "ramp/kyc/requirement",
    "ramp/kyc/user",
    "ramp/order/create",
    "ramp/order/confirm-payment",
    "ramp/order/status",

    /*
    --------------------------------------------------
    Transak widget
    --------------------------------------------------
    */

    "ramp/transak/widget"
  ]);

const CLERK_AUTH_ENDPOINTS =
  new Set([
    "account",

    "fiat/session/register",
    "fiat/kyc/create",
    "fiat/kyc/shared/create",
    "fiat/transak-virtual-account/create",
    "fiat/payout-history",

    /*
    --------------------------------------------------
    Exthand authenticated endpoints
    --------------------------------------------------
    */

    EXTHAND_START_ENDPOINT,
    EXTHAND_REFRESH_ENDPOINT,
    EXTHAND_BANKS_ENDPOINT,

    /*
    --------------------------------------------------
    Receive authenticated endpoints
    --------------------------------------------------
    */

    "receive",
    "receive/pricing-preview"
  ]);

function normalizeEndpoint(value) {
  return String(
    value ||
    ""
  )
    .replace(
      /^\/+/,
      ""
    )
    .replace(
      /\/+$/,
      ""
    );
}

function normalizeHeader(value) {
  if (
    Array.isArray(
      value
    )
  ) {
    return (
      value[0] ||
      ""
    );
  }

  return (
    value ||
    ""
  );
}

function isRepeatPayoutEndpoint(
  endpoint
) {
  return /^fiat\/repeat-payout\/[^/]+$/
    .test(
      endpoint
    );
}

function isSharedKycReconcileEndpoint(
  endpoint
) {
  return /^fiat\/kyc\/shared\/kyc_[A-Za-z0-9_-]+\/reconcile$/
    .test(
      endpoint
    );
}

/*
--------------------------------------------------
Receive dynamic endpoints
--------------------------------------------------
*/

function isReceivePublicResolveEndpoint(
  endpoint
) {
  return /^receive\/ub_rcv_[A-Za-z0-9_-]{43}$/
    .test(
      endpoint
    );
}

function isReceiveProfileEndpoint(
  endpoint
) {
  return /^receive\/rcv_[A-Za-z0-9_-]+$/
    .test(
      endpoint
    );
}

function isReceiveDeactivateEndpoint(
  endpoint
) {
  return /^receive\/rcv_[A-Za-z0-9_-]+\/deactivate$/
    .test(
      endpoint
    );
}

function isReceiveDynamicEndpoint(
  endpoint
) {
  return (
    isReceivePublicResolveEndpoint(
      endpoint
    ) ||
    isReceiveProfileEndpoint(
      endpoint
    ) ||
    isReceiveDeactivateEndpoint(
      endpoint
    )
  );
}

function isAllowedEndpoint(
  endpoint
) {
  return (
    ALLOWED.has(
      endpoint
    ) ||
    isRepeatPayoutEndpoint(
      endpoint
    ) ||
    isSharedKycReconcileEndpoint(
      endpoint
    ) ||
    isReceiveDynamicEndpoint(
      endpoint
    )
  );
}

function requiresClerkAuthorization(
  endpoint
) {
  return (
    CLERK_AUTH_ENDPOINTS.has(
      endpoint
    ) ||
    isRepeatPayoutEndpoint(
      endpoint
    ) ||
    isSharedKycReconcileEndpoint(
      endpoint
    ) ||
    isReceiveProfileEndpoint(
      endpoint
    ) ||
    isReceiveDeactivateEndpoint(
      endpoint
    )
  );
}

function buildUpstreamUrl(
  endpoint,
  query = {}
) {
  const url =
    new URL(
      `${API_BASE}/${endpoint}`
    );

  Object
    .entries(
      query ||
      {}
    )
    .forEach(
      ([
        key,
        value
      ]) => {
        if (
          key === "endpoint" ||
          key === "partner" ||
          value === undefined ||
          value === null ||
          value === ""
        ) {
          return;
        }

        url.searchParams.set(
          key,
          String(
            value
          )
        );
      }
    );

  return url.toString();
}

function buildSignature(
  payload,
  secret
) {
  return crypto
    .createHmac(
      "sha256",
      secret
    )
    .update(
      payload
    )
    .digest(
      "hex"
    );
}

function parseUpstreamText(text) {
  try {
    return JSON.parse(
      text
    );
  }
  catch {
    return {
      raw:
        text
    };
  }
}

function getAllowedMethod(
  endpoint
) {
  /*
  --------------------------------------------------
  Receive
  --------------------------------------------------
  */

  if (
    isReceivePublicResolveEndpoint(
      endpoint
    )
  ) {
    return "GET";
  }

  if (
    isReceiveProfileEndpoint(
      endpoint
    )
  ) {
    return "PATCH";
  }

  if (
    isReceiveDeactivateEndpoint(
      endpoint
    )
  ) {
    return "POST";
  }

  /*
  --------------------------------------------------
  Existing GET endpoints
  --------------------------------------------------
  */

  if (
    endpoint ===
      "settlement/status" ||
    endpoint ===
      "ramp/user" ||
    endpoint ===
      "ramp/kyc/requirement" ||
    endpoint ===
      "ramp/order/status" ||
    endpoint ===
      "options/corridors" ||
    endpoint ===
      "options/coinsph/ph-payout-channels" ||
    endpoint ===
      "options/elementpay/ng-banks" ||
    endpoint ===
      "options/ramp-source-availability" ||
    endpoint ===
      "options/executor-availability" ||
    endpoint ===
      "fiat/bridge-tos/ping" ||
    endpoint ===
      "fiat/payout-history" ||
    endpoint ===
      EXTHAND_BANKS_ENDPOINT ||
    isRepeatPayoutEndpoint(
      endpoint
    )
  ) {
    return "GET";
  }

  if (
    endpoint ===
    "ramp/kyc/user"
  ) {
    return "PATCH";
  }

  return "POST";
}

function isAllowedMethod(
  endpoint,
  method
) {
  if (
    endpoint ===
    "account"
  ) {
    return (
      method === "GET" ||
      method === "DELETE"
    );
  }

  return (
    method ===
    getAllowedMethod(
      endpoint
    )
  );
}

function normalizeForwardedFor(
  value
) {
  if (
    Array.isArray(
      value
    )
  ) {
    return value.join(
      ","
    );
  }

  return (
    value ||
    ""
  );
}

function resolveAuthorizationHeader(
  req = {}
) {
  return normalizeHeader(
    req.headers?.authorization ||
    req.headers?.Authorization
  );
}

/*
--------------------------------------------------
Clerk authorization forwarding
--------------------------------------------------

Any authenticated Pay surface may send a Clerk
Bearer token through this proxy.

The proxy forwards the token whenever present.

Forwarding Authorization does NOT change upstream
route authentication policy.

Only endpoints explicitly marked as requiring
Clerk authorization reject missing tokens here.
--------------------------------------------------
*/

function attachClerkAuthorization({
  req,
  endpoint,
  headers
}) {
  const authorization =
    resolveAuthorizationHeader(
      req
    );

  if (authorization) {
    headers.authorization =
      authorization;
  }

  if (
    requiresClerkAuthorization(
      endpoint
    ) &&
    !authorization
  ) {
    return "missing_clerk_bearer_token";
  }

  return null;
}

/*
--------------------------------------------------
Upstream timeout policy

Most endpoints retain the 15-second budget.

Quote and Receive pricing retain 70 seconds.

Exthand endpoints use 45 seconds.

A timeout during Exthand initiation is ambiguous.
The frontend must never automatically retry /start.
--------------------------------------------------
*/

function resolveUpstreamTimeoutMs(
  endpoint
) {
  if (
    endpoint ===
      "session/quote" ||
    endpoint ===
      "receive/pricing-preview"
  ) {
    return SESSION_QUOTE_TIMEOUT_MS;
  }

  if (
    EXTHAND_ENDPOINTS.has(
      endpoint
    )
  ) {
    return EXTHAND_TIMEOUT_MS;
  }

  return DEFAULT_UPSTREAM_TIMEOUT_MS;
}

function resolvePartnerConfig(
  req = {}
) {
  const partner =
    normalizeEndpoint(
      req.query?.partner
    );

  if (
    partner ===
    "fiat_bank_transfer"
  ) {
    return {
      partner_id:
        "fiat_bank_transfer",

      secret:
        FIAT_BANK_TRANSFER_SECRET
    };
  }

  return {
    partner_id:
      "surface",

    secret:
      SURFACE_SECRET
  };
}

export default async function handler(
  req,
  res
) {
  try {
    const endpoint =
      normalizeEndpoint(
        req.query.endpoint
      );

    if (
      !endpoint
    ) {
      return res
        .status(
          400
        )
        .json({
          error:
            "missing_endpoint"
        });
    }

    if (
      !isAllowedEndpoint(
        endpoint
      )
    ) {
      return res
        .status(
          403
        )
        .json({
          error:
            "endpoint_not_allowed"
        });
    }

    const partnerConfig =
      resolvePartnerConfig(
        req
      );

    /*
    --------------------------------------------------
    Exthand trial scope

    Only the Fiat Bank Transfer partner may use
    these proxy endpoints during the trial.

    Upstream Clerk authentication remains mandatory.
    --------------------------------------------------
    */

    if (
      EXTHAND_ENDPOINTS.has(
        endpoint
      ) &&
      partnerConfig.partner_id !==
        "fiat_bank_transfer"
    ) {
      return res
        .status(
          403
        )
        .json({
          error:
            "exthand_fiat_only"
        });
    }

    if (
      !API_BASE ||
      !partnerConfig.secret
    ) {
      return res
        .status(
          500
        )
        .json({
          error:
            "server_misconfigured"
        });
    }

    const incomingMethod =
      String(
        req.method ||
        ""
      ).toUpperCase();

    if (
      !isAllowedMethod(
        endpoint,
        incomingMethod
      )
    ) {
      return res
        .status(
          405
        )
        .json({
          error:
            "method_not_allowed"
        });
    }

    const controller =
      new AbortController();

    const upstreamTimeoutMs =
      resolveUpstreamTimeoutMs(
        endpoint
      );

    const timeout =
      setTimeout(
        () => {
          controller.abort();
        },
        upstreamTimeoutMs
      );

    let upstream;

    try {
      const headers = {
        "x-ub-partner-id":
          partnerConfig.partner_id,

        "x-forwarded-host":
          req.headers.host ||
          "",

        "x-forwarded-for":
          normalizeForwardedFor(
            req.headers[
              "x-forwarded-for"
            ]
          )
      };

      const clerkAuthError =
        attachClerkAuthorization({
          req,
          endpoint,
          headers
        });

      if (
        clerkAuthError
      ) {
        return res
          .status(
            401
          )
          .json({
            error:
              clerkAuthError
          });
      }

      if (
        incomingMethod ===
        "GET"
      ) {
        upstream =
          await fetch(
            buildUpstreamUrl(
              endpoint,
              req.query
            ),
            {
              method:
                "GET",

              headers,

              signal:
                controller.signal
            }
          );
      }
      else {
        const payload =
          JSON.stringify(
            req.body ||
            {}
          );

        if (
          payload.length >
          10000
        ) {
          return res
            .status(
              413
            )
            .json({
              error:
                "payload_too_large"
            });
        }

        headers[
          "content-type"
        ] =
          "application/json";

        headers[
          "x-ub-signature"
        ] =
          buildSignature(
            payload,
            partnerConfig.secret
          );

        upstream =
          await fetch(
            buildUpstreamUrl(
              endpoint
            ),
            {
              method:
                incomingMethod,

              headers,

              body:
                payload,

              signal:
                controller.signal
            }
          );
      }
    }
    finally {
      clearTimeout(
        timeout
      );
    }

    const text =
      await upstream.text();

    const data =
      parseUpstreamText(
        text
      );

    return res
      .status(
        upstream.status
      )
      .json(
        data
      );
  }
  catch (error) {
    console.error(
      "PROXY_ERROR",
      error
    );

    if (
      error?.name ===
      "AbortError"
    ) {
      return res
        .status(
          504
        )
        .json({
          error:
            "upstream_timeout"
        });
    }

    return res
      .status(
        500
      )
      .json({
        error:
          "surface_proxy_error"
      });
  }
}
