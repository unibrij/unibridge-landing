// fiat/bank-transfer/js/sessionApi.js

import {
  getBackendUrl
} from "./config.js";

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

async function postJson(path, payload = {}) {
  const response =
    await fetch(
      getBackendUrl(path),
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
    "/v2/session/register",
    payload
  );
}

export function resolveSession(payload = {}) {
  return postJson(
    "/v2/session/resolve",
    payload
  );
}

export function quoteSession(payload = {}) {
  return postJson(
    "/v2/session/quote",
    payload
  );
}

export function createSettlement(payload = {}) {
  return postJson(
    "/v2/settlement/create",
    payload
  );
}
