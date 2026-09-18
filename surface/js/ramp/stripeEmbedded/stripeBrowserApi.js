// unibridge-landing/surface/js/ramp/stripeEmbedded/stripeBrowserApi.js

import {
  buildClerkAuthorizationHeader
} from "/shared/pay/auth/clerkAuth.js";


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


function resolveErrorCode(
  payload
) {
  return (
    normalizeString(
      payload?.error?.code
    ) ||
    normalizeString(
      payload?.code
    ) ||
    null
  );
}


function resolveErrorMessage({
  payload,
  status,
  errorPrefix
}) {
  const candidates = [
    payload?.error?.message,
    payload?.message,
    payload?.error,
    payload?.code
  ];

  for (
    const candidate
    of candidates
  ) {
    if (
      typeof candidate !==
        "string"
    ) {
      continue;
    }

    const message =
      normalizeString(
        candidate
      );

    if (message) {
      return message;
    }
  }

  return (
    resolveErrorCode(
      payload
    ) ||
    `${errorPrefix}_http_${status}`
  );
}


async function parseJsonResponse({
  response,
  errorPrefix
}) {
  const text =
    await response.text();

  let payload =
    null;

  if (text) {
    try {
      payload =
        JSON.parse(
          text
        );
    } catch {
      payload = {
        raw:
          text
      };
    }
  }

  if (!response.ok) {
    const error =
      new Error(
        resolveErrorMessage({
          payload,
          status:
            response.status,
          errorPrefix
        })
      );

    error.status =
      response.status;

    error.code =
      resolveErrorCode(
        payload
      );

    error.payload =
      payload;

    throw error;
  }

  return payload;
}


async function buildAuthenticatedHeaders(
  headers = {}
) {
  const authHeaders =
    await buildClerkAuthorizationHeader();

  const authorization =
    normalizeString(
      authHeaders?.Authorization
    );

  if (!authorization) {
    throw new Error(
      "stripe_browser_auth_missing"
    );
  }

  return {
    Accept:
      "application/json",

    ...headers,

    ...authHeaders
  };
}


/*
--------------------------------------------------
Authenticated Stripe browser request

This module owns transport only:

  Clerk Bearer
  fetch
  JSON parsing
  normalized HTTP errors

It must not own Stripe flow or business logic.
--------------------------------------------------
*/

export async function stripeBrowserRequestJson(
  url,
  {
    method = "GET",
    body,
    headers = {},
    cache = "no-store",
    errorPrefix =
      "stripe_browser"
  } = {}
) {
  const normalizedUrl =
    requireString(
      url,
      "stripe_browser_url_required"
    );

  const normalizedMethod =
    requireString(
      method,
      "stripe_browser_method_required"
    )
      .toUpperCase();

  const requestHeaders =
    await buildAuthenticatedHeaders(
      body === undefined
        ? headers
        : {
            "Content-Type":
              "application/json",

            ...headers
          }
    );

  const options = {
    method:
      normalizedMethod,

    headers:
      requestHeaders,

    cache
  };

  if (
    body !== undefined
  ) {
    options.body =
      JSON.stringify(
        body
      );
  }

  const response =
    await fetch(
      normalizedUrl,
      options
    );

  return parseJsonResponse({
    response,
    errorPrefix:
      requireString(
        errorPrefix,
        "stripe_browser_error_prefix_required"
      )
  });
}


export function stripeBrowserPostJson(
  url,
  body = {},
  {
    headers = {},
    errorPrefix =
      "stripe_browser"
  } = {}
) {
  return stripeBrowserRequestJson(
    url,
    {
      method:
        "POST",

      body,

      headers,

      errorPrefix
    }
  );
}


export function stripeBrowserGetJson(
  url,
  {
    headers = {},
    errorPrefix =
      "stripe_browser"
  } = {}
) {
  return stripeBrowserRequestJson(
    url,
    {
      method:
        "GET",

      headers,

      errorPrefix
    }
  );
}
