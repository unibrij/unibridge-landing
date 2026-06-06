// fiat/bank-transfer/js/api.js

import {
  buildClerkAuthorizationHeader
} from "./clerkAuth.js";

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

async function postJson(
  endpoint,
  payload = {},
  {
    headers = {}
  } = {}
) {
  const response =
    await fetch(
      buildProxyUrl(endpoint),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...headers
        },
        body:
          JSON.stringify(payload)
      }
    );

  return parseJsonResponse(response);
}

async function getJson(
  endpoint,
  {
    headers = {}
  } = {}
) {
  const response =
    await fetch(
      buildProxyUrl(endpoint),
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...headers
        }
      }
    );

  return parseJsonResponse(response);
}

export async function createFiatKyc({
  settlement_id,
  bank_customer_ref,
  bank_verified_identity_ref,
  source_country,
  source_rail
}) {
  const authHeaders =
    await buildClerkAuthorizationHeader();

  return postJson(
    "fiat/kyc/create",
    {
      settlement_id,
      bank_customer_ref,
      bank_verified_identity_ref,
      source_country,
      source_rail
    },
    {
      headers:
        authHeaders
    }
  );
}

export function createBridgeTos({
  settlement_id
}) {
  return postJson(
    "fiat/bridge-tos/create",
    {
      settlement_id
    }
  );
}

export function createBridgeCustomer({
  settlement_id,
  customer = {}
} = {}) {
  return postJson(
    "fiat/bridge-customer/create",
    {
      settlement_id,

      ...customer
    }
  );
}

export function createBridgeBankTransfer({
  settlement_id,
  source_country,
  source_rail
}) {
  return postJson(
    "fiat/bridge-bank-transfer/create",
    {
      settlement_id,
      source_country,
      source_rail
    }
  );
}

export function getBridgeTosPing() {
  return getJson(
    "fiat/bridge-tos/ping"
  );
}
