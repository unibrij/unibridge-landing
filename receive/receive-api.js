// unibridge-landing/receive/receive-api.js

import {
  buildClerkAuthorizationHeader
} from "/shared/pay/auth/clerkAuth.js";


function normalizeString(value) {
  return String(
    value ??
    ""
  ).trim();
}


function parseResponseError(
  payload,
  fallback
) {
  const error =
    payload?.error;

  if (
    typeof error ===
      "string" &&
    normalizeString(
      error
    )
  ) {
    return normalizeString(
      error
    );
  }

  if (
    error &&
    typeof error ===
      "object"
  ) {
    const nestedError =
      normalizeString(
        error.message
      ) ||
      normalizeString(
        error.code
      );

    if (nestedError) {
      return nestedError;
    }
  }

  return (
    normalizeString(
      payload?.message
    ) ||
    normalizeString(
      payload?.code
    ) ||
    fallback
  );
}


async function fetchJson(
  url,
  options = {}
) {
  const response =
    await fetch(
      url,
      options
    );

  const text =
    await response.text();

  let payload = {};

  if (text) {
    try {
      payload =
        JSON.parse(
          text
        );
    }
    catch {
      payload = {
        raw:
          text
      };
    }
  }

  if (!response.ok) {
    throw new Error(
      parseResponseError(
        payload,
        `Request failed (${response.status})`
      )
    );
  }

  return payload;
}


function normalizeProxyEndpoint(
  endpoint
) {
  return normalizeString(
    endpoint
  )
    .replace(
      /^https?:\/\/[^/]+/i,
      ""
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
  endpoint
) {
  const normalized =
    normalizeProxyEndpoint(
      endpoint
    );

  if (!normalized) {
    throw new Error(
      "Receive API endpoint missing."
    );
  }

  const queryIndex =
    normalized.indexOf(
      "?"
    );

  const path =
    queryIndex >= 0
      ? normalized.slice(
          0,
          queryIndex
        )
      : normalized;

  const queryString =
    queryIndex >= 0
      ? normalized.slice(
          queryIndex + 1
        )
      : "";

  const normalizedPath =
    normalizeString(
      path
    );

  if (!normalizedPath) {
    throw new Error(
      "Receive API endpoint missing."
    );
  }

  const params =
    new URLSearchParams(
      queryString
    );

  params.set(
    "endpoint",
    normalizedPath
  );

  return (
    "/api/proxy?" +
    params.toString()
  );
}


export async function loadReceiveCatalog() {
  return fetchJson(
    buildProxyUrl(
      "options/corridors"
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
}


export async function loadReceiveFieldOptions(
  endpoint
) {
  return fetchJson(
    buildProxyUrl(
      endpoint
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
}


export async function createReceiveProfile({
  routeId,
  beneficiary
}) {
  const normalizedRouteId =
    normalizeString(
      routeId
    );

  if (!normalizedRouteId) {
    throw new Error(
      "Receive route missing."
    );
  }

  if (
    !beneficiary ||
    typeof beneficiary !==
      "object" ||
    Array.isArray(
      beneficiary
    )
  ) {
    throw new Error(
      "Receive beneficiary missing."
    );
  }

  const authorizationHeaders =
    await buildClerkAuthorizationHeader();

  return fetchJson(
    buildProxyUrl(
      "receive"
    ),
    {
      method:
        "POST",

      headers: {
        Accept:
          "application/json",

        "Content-Type":
          "application/json",

        ...authorizationHeaders
      },

      body:
        JSON.stringify({
          route_id:
            normalizedRouteId,

          beneficiary
        })
    }
  );
}
