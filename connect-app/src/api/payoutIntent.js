// connect-app/src/api/payoutIntent.js

import {
  API_BASE,
  assertOk,
  parseJson
} from "./client.js";


export async function createPayoutIntent({
  connectSessionId,
  walletAddress,
  route,
  form,
  receiveProfileId = null
}) {
  if (!route) {
    throw new Error(
      "connect_route_required"
    );
  }

  if (!form) {
    throw new Error(
      "payout_form_required"
    );
  }

  const fundingAsset =
    form.asset ??
    route.asset;

  if (!fundingAsset) {
    throw new Error(
      "funding_asset_required"
    );
  }

  const normalizedReceiveProfileId =
    String(
      receiveProfileId ||
      ""
    ).trim() ||
    null;

  const requestBody = {
    connect_session_id:
      connectSessionId,

    wallet_address:
      walletAddress,

    amount:
      form.amount,

    asset:
      fundingAsset,

    network:
      route.network
  };

  /*
   * Standard payout intent carries the browser-owned
   * destination specification.
   *
   * Receive payout intent carries only the Receive
   * profile reference. The actual destination and
   * beneficiary remain authoritative on Core.
   */
  if (
    normalizedReceiveProfileId
  ) {
    requestBody.receive_profile_id =
      normalizedReceiveProfileId;
  }
  else {
    requestBody.country =
      route.country;

    requestBody.rail =
      route.rail;

    requestBody.beneficiary = {
      rail:
        route.rail,

      country:
        route.country,

      ...form.beneficiary
    };
  }

  const response =
    await fetch(
      `${API_BASE}/connect/payout-intent`,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(
            requestBody
          )
      }
    );

  const data =
    await parseJson(
      response
    );

  assertOk(
    response,
    data,
    "payout_intent_failed"
  );

  return data;
}


export async function requestAuthorizationMessage({
  payoutIntentId
}) {
  const response =
    await fetch(
      `${API_BASE}/connect/payout-authorize/message`,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            payout_intent_id:
              payoutIntentId
          })
      }
    );

  const data =
    await parseJson(
      response
    );

  assertOk(
    response,
    data,
    "authorization_message_failed"
  );

  return data;
}


export async function submitAuthorization({
  payoutIntentId,
  message,
  nonce,
  signature
}) {
  const response =
    await fetch(
      `${API_BASE}/connect/payout-authorize/submit`,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            payout_intent_id:
              payoutIntentId,

            message,
            nonce,
            signature
          })
      }
    );

  const data =
    await parseJson(
      response
    );

  assertOk(
    response,
    data,
    "authorization_submit_failed"
  );

  return data;
}


export async function createSettlement({
  payoutIntentId
}) {
  const response =
    await fetch(
      `${API_BASE}/connect/payout-intent/create-settlement`,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            payout_intent_id:
              payoutIntentId
          })
      }
    );

  const data =
    await parseJson(
      response
    );

  assertOk(
    response,
    data,
    "create_settlement_failed"
  );

  return data;
}


export async function getPayoutIntent({
  payoutIntentId
}) {
  const response =
    await fetch(
      `${API_BASE}/connect/payout-intent/${encodeURIComponent(
        payoutIntentId
      )}`,
      {
        method:
          "GET",

        headers: {
          "Content-Type":
            "application/json"
        }
      }
    );

  const data =
    await parseJson(
      response
    );

  assertOk(
    response,
    data,
    "get_payout_intent_failed"
  );

  if (!data.payout_intent) {
    throw new Error(
      "payout_intent_missing"
    );
  }

  return data.payout_intent;
}
