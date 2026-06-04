// fiat/bank-transfer/js/api.js

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

async function getJson(path) {
  const response =
    await fetch(
      getBackendUrl(path),
      {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      }
    );

  return parseJsonResponse(response);
}

export function createFiatKyc({
  settlement_id,
  bank_customer_ref,
  bank_verified_identity_ref,
  source_country,
  source_rail
}) {
  return postJson(
    "/v2/fiat/kyc/create",
    {
      settlement_id,
      bank_customer_ref,
      bank_verified_identity_ref,
      source_country,
      source_rail
    }
  );
}

export function createBridgeTos({
  settlement_id
}) {
  return postJson(
    "/v2/fiat/bridge-tos/create",
    {
      settlement_id
    }
  );
}

export function createBridgeCustomer(payload = {}) {
  return postJson(
    "/v2/fiat/bridge-customer/create",
    payload
  );
}

export function createBridgeBankTransfer({
  settlement_id,
  source_country,
  source_rail
}) {
  return postJson(
    "/v2/fiat/bridge-bank-transfer/create",
    {
      settlement_id,
      source_country,
      source_rail
    }
  );
}

export function getBridgeTosPing() {
  return getJson(
    "/v2/fiat/bridge-tos/ping"
  );
}
