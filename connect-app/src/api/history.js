// connect-app/src/api/history.js

import {
  API_BASE,
  assertOk,
  parseJson
} from "./client.js";


function normalizeString(
  value
) {
  return String(
    value ||
    ""
  ).trim();
}


function buildConnectReadHeaders(
  walletAddress
) {
  const normalizedWalletAddress =
    normalizeString(
      walletAddress
    );

  if (
    !normalizedWalletAddress
  ) {
    throw new Error(
      "connect_wallet_address_required"
    );
  }

  return {
    "Content-Type":
      "application/json",

    "x-unibridge-wallet-address":
      normalizedWalletAddress
  };
}


function normalizeHistoryLimit(
  value
) {
  const parsed =
    Number(
      value
    );

  return (
    Number.isFinite(
      parsed
    ) &&
    parsed > 0
  )
    ? Math.min(
        50,
        Math.trunc(
          parsed
        )
      )
    : 20;
}


function projectHistoryResponse(
  data = {}
) {
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


export async function getPayoutHistory({
  walletAddress,
  limit = 20
}) {
  const normalizedLimit =
    normalizeHistoryLimit(
      limit
    );

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
          buildConnectReadHeaders(
            walletAddress
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

  return projectHistoryResponse(
    data
  );
}


export async function getRepeatPayoutSource({
  sourcePayoutIntentId,
  walletAddress
}) {
  const normalizedSourcePayoutIntentId =
    normalizeString(
      sourcePayoutIntentId
    );

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
          buildConnectReadHeaders(
            walletAddress
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
  walletAddress
}) {
  const normalizedSourcePayoutIntentId =
    normalizeString(
      sourcePayoutIntentId
    );

  const normalizedConnectSessionId =
    normalizeString(
      connectSessionId
    );

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

  if (
    !normalizedAmount
  ) {
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
          buildConnectReadHeaders(
            walletAddress
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
