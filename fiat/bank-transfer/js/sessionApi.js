// fiat/bank-transfer/js/sessionApi.js

async function parseJsonResponse(response) {
  const body =
    await response.json().catch(() => ({}));

  if (!response.ok || body?.ok === false) {
    const error =
      new Error(
        body?.error ||
        `request_failed_${response.status}`
      );

    error.status =
      response.status;

    error.body =
      body;

    throw error;
  }

  return body;
}

function normalizeEndpoint(endpoint) {
  return String(endpoint || "")
    .replace(/^\/+/, "")
    .replace(/^v2\//, "");
}

function buildProxyUrl(endpoint) {
  return (
    "/api/proxy?partner=fiat_bank_transfer&endpoint=" +
    encodeURIComponent(
      normalizeEndpoint(endpoint)
    )
  );
}

async function postJson(endpoint, payload = {}) {
  const response =
    await fetch(
      buildProxyUrl(endpoint),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body:
          JSON.stringify(payload)
      }
    );

  return parseJsonResponse(response);
}

export function registerSession(payload = {}) {
  return postJson(
    "session/register",
    payload
  );
}

export function resolveSession(payload = {}) {
  return postJson(
    "session/resolve",
    payload
  );
}

export function quoteSession(payload = {}) {
  return postJson(
    "session/quote",
    payload
  );
}

export function createSettlement(payload = {}) {
  return postJson(
    "settlement/create",
    payload
  );
}

export function createBridgeBankTransfer(payload = {}) {
  return postJson(
    "fiat/bridge-bank-transfer/create",
    payload
  );
}
