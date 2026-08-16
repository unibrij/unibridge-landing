// pay-by-bank/js/api.js

/*
--------------------------------------------------
Pay-by-Bank API

Browser-side client for the existing generic
UniBridge ramp flow.

The browser never owns the HMAC secret.

All requests go through:

  /api/proxy

The proxy signs the upstream request using the
existing Surface partner credentials.

Pay-by-Bank remains:

  funding_mode = ramp
  funding_method = bank_transfer

The generic Surface partner already owns
funding_mode = ramp.

funding_method is supplied explicitly during
session registration.

Canonical frontend flow:

  session/register
  → session/resolve
  → session/quote
  → settlement/create
  → funding/session
  → next_action redirect
  → settlement/status

There is intentionally no frontend
settlement/confirm call.

Funding confirmation and the transition into the
next settlement lifecycle step are owned by the
backend canonical funding verification path.
--------------------------------------------------
*/

function normalizeString(
  value
) {
  return String(
    value ?? ""
  ).trim();
}


function normalizeEndpoint(
  endpoint
) {
  return normalizeString(
    endpoint
  )
    .replace(
      /^\/+/,
      ""
    )
    .replace(
      /^v2\//,
      ""
    );
}


function buildProxyUrl(
  endpoint,
  query = {}
) {
  const url =
    new URL(
      "/api/proxy",
      window.location.origin
    );

  url.searchParams.set(
    "endpoint",
    normalizeEndpoint(
      endpoint
    )
  );

  Object.entries(
    query || {}
  ).forEach(([
    key,
    value
  ]) => {
    if (
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
  });

  return (
    url.pathname +
    url.search
  );
}


async function parseJsonResponse(
  response
) {
  const text =
    await response.text();

  let body = {};

  if (text) {
    try {
      body =
        JSON.parse(
          text
        );
    }
    catch {
      body = {
        raw:
          text
      };
    }
  }

  if (
    !response.ok ||
    body?.ok === false
  ) {
    const errorCode =
      normalizeString(
        body?.error ||
        body?.reason ||
        body?.state
      ) ||
      `request_failed_${response.status}`;

    const error =
      new Error(
        normalizeString(
          body?.message
        ) ||
        errorCode
      );

    error.code =
      errorCode;

    error.status =
      response.status;

    error.body =
      body;

    error.reason =
      body?.reason ??
      null;

    error.state =
      body?.state ??
      null;

    error.retryable =
      body?.retryable ??
      null;

    error.pending =
      body?.pending ??
      null;

    throw error;
  }

  return body;
}


async function postJson(
  endpoint,
  payload = {}
) {
  const response =
    await fetch(
      buildProxyUrl(
        endpoint
      ),
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json"
        },

        body:
          JSON.stringify(
            payload || {}
          )
      }
    );

  return parseJsonResponse(
    response
  );
}


async function getJson(
  endpoint,
  query = {}
) {
  const response =
    await fetch(
      buildProxyUrl(
        endpoint,
        query
      ),
      {
        method:
          "GET",

        headers: {
          Accept:
            "application/json"
        }
      }
    );

  return parseJsonResponse(
    response
  );
}


/*
--------------------------------------------------
Session registration
--------------------------------------------------

Do not send delivery_options from the browser.

The backend resolver owns route/delivery discovery.

Pay-by-Bank explicitly persists:

  funding_method = bank_transfer

on the session.
--------------------------------------------------
*/

export async function registerPayByBankSession({
  source_country,
  receiver_country
} = {}) {
  return postJson(
    "session/register",
    {
      source_country,

      receiver_country,

      funding_method:
        "bank_transfer"
    }
  );
}


export async function resolveSession({
  session_id
} = {}) {
  return postJson(
    "session/resolve",
    {
      session_id
    }
  );
}


export async function quoteSession({
  session_id,
  amount
} = {}) {
  return postJson(
    "session/quote",
    {
      session_id,
      amount
    }
  );
}


/*
--------------------------------------------------
Settlement
--------------------------------------------------
*/

export async function createSettlement({
  session_id,
  route_id,
  destination,
  redirect_url
} = {}) {
  return postJson(
    "settlement/create",
    {
      session_id,

      route_id,

      destination,

      redirect_url
    }
  );
}


/*
--------------------------------------------------
Funding session
--------------------------------------------------

The backend prepares the already-selected ramp sender.

For Onramp Pay-by-Bank this ultimately returns a
redirect next_action containing the provider
paymentLink.
--------------------------------------------------
*/

export async function getFundingSession({
  settlement_id
} = {}) {
  return postJson(
    "funding/session",
    {
      settlement_id
    }
  );
}


/*
--------------------------------------------------
Settlement status
--------------------------------------------------

There is intentionally no frontend
settlement/confirm step.

The canonical backend funding watcher verifies the
actual on-chain funding and dispatches the next
settlement lifecycle step automatically.

The browser only observes settlement status.
--------------------------------------------------
*/

export async function getSettlementStatus({
  settlement_id
} = {}) {
  return getJson(
    "settlement/status",
    {
      settlement_id
    }
  );
}


/*
--------------------------------------------------
Normalized response helpers
--------------------------------------------------
*/

export function extractSessionId(
  result = {}
) {
  return (
    normalizeString(
      result.session_id
    ) ||
    null
  );
}


export function extractSettlementId(
  result = {}
) {
  return (
    normalizeString(
      result.settlement_id
    ) ||
    null
  );
}


export function extractRoutes(
  result = {}
) {
  return Array.isArray(
    result.routes
  )
    ? result.routes
    : [];
}


export function extractRouteId(
  route = {}
) {
  return (
    normalizeString(
      route.route_id ||
      route.id
    ) ||
    null
  );
}


export function extractNextAction(
  result = {}
) {
  const nextAction =
    result?.next_action;

  if (
    !nextAction ||
    typeof nextAction !==
      "object" ||
    Array.isArray(
      nextAction
    )
  ) {
    return null;
  }

  return nextAction;
}


export function extractRedirectUrl(
  result = {}
) {
  const nextAction =
    extractNextAction(
      result
    );

  if (
    nextAction?.type !==
    "redirect"
  ) {
    return null;
  }

  return (
    normalizeString(
      nextAction.url
    ) ||
    null
  );
}


export function extractTransactionId(
  result = {}
) {
  const nextAction =
    extractNextAction(
      result
    );

  return (
    normalizeString(
      nextAction
        ?.meta
        ?.transaction_id
    ) ||
    null
  );
}
