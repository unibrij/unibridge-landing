// connect-app/src/api/history.js

import {
  API_BASE,
  assertOk,
  buildCustomerAuthHeaders,
  parseJson
} from "./client.js";


export async function getPayoutHistory({
  accessToken,
  limit = 20
}) {
  const parsedLimit =
    Number(
      limit
    );

  const normalizedLimit =
    Number.isFinite(
      parsedLimit
    ) &&
    parsedLimit > 0
      ? Math.min(
          50,
          Math.trunc(
            parsedLimit
          )
        )
      : 20;

  const params =
    new URLSearchParams({
      limit:
        String(
          normalizedLimit
        )
    });

  const response =
    await fetch(
      `${API_BASE}/connect/payout-history?${params.toString()}`,
      {
        method:
          "GET",

        headers:
          buildCustomerAuthHeaders(
            accessToken
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
    "get_payout_history_failed"
  );

  return {
    recent_recipients:
      Array.isArray(
        data.recent_recipients
      )
        ? data.recent_recipients
        : [],

    recent_payouts:
      Array.isArray(
        data.recent_payouts
      )
        ? data.recent_payouts
        : []
  };
}


export async function getRepeatPayoutSource({
  sourcePayoutIntentId,
  accessToken
}) {
  const normalizedSourcePayoutIntentId =
    String(
      sourcePayoutIntentId ||
      ""
    ).trim();

  if (
    !normalizedSourcePayoutIntentId
  ) {
    throw new Error(
      "source_payout_intent_id_required"
    );
  }

  const response =
    await fetch(
      `${API_BASE}/connect/repeat-payout/${encodeURIComponent(
        normalizedSourcePayoutIntentId
      )}`,
      {
        method:
          "GET",

        headers:
          buildCustomerAuthHeaders(
            accessToken
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
    "get_repeat_payout_source_failed"
  );

  if (
    !data.route_id ||
    !data.beneficiary
  ) {
    throw new Error(
      "repeat_payout_source_incomplete"
    );
  }

  return data;
}


export async function repeatPayout({
  sourcePayoutIntentId,
  connectSessionId,
  amount,
  accessToken
}) {
  const normalizedSourcePayoutIntentId =
    String(
      sourcePayoutIntentId ||
      ""
    ).trim();

  const normalizedConnectSessionId =
    String(
      connectSessionId ||
      ""
    ).trim();

  const normalizedAmount =
    String(
      amount ??
      ""
    ).trim();

  if (
    !normalizedSourcePayoutIntentId
  ) {
    throw new Error(
      "source_payout_intent_id_required"
    );
  }

  if (
    !normalizedConnectSessionId
  ) {
    throw new Error(
      "connect_session_id_required"
    );
  }

  if (!normalizedAmount) {
    throw new Error(
      "amount_required"
    );
  }

  const response =
    await fetch(
      `${API_BASE}/connect/repeat-payout`,
      {
        method:
          "POST",

        headers:
          buildCustomerAuthHeaders(
            accessToken
          ),

        body:
          JSON.stringify({
            source_payout_intent_id:
              normalizedSourcePayoutIntentId,

            connect_session_id:
              normalizedConnectSessionId,

            amount:
              normalizedAmount
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
    "repeat_payout_failed"
  );

  if (
    !data.payout_intent_id
  ) {
    throw new Error(
      "repeated_payout_intent_missing"
    );
  }

  return data;
}
