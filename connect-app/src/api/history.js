// connect-app/src/api/history.js

import {
  API_BASE,
  assertOk,
  buildCustomerAuthHeaders,
  parseJson
} from "./client.js";


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
  accessToken,
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

  return projectHistoryResponse(
    data
  );
}


export async function createHistoryChallenge({
  connectSessionId
}) {
  const normalizedConnectSessionId =
    String(
      connectSessionId ||
      ""
    ).trim();

  if (
    !normalizedConnectSessionId
  ) {
    throw new Error(
      "connect_session_id_required"
    );
  }

  const response =
    await fetch(
      `${API_BASE}/connect/payout-history/challenge`,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            connect_session_id:
              normalizedConnectSessionId
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
    "history_challenge_failed"
  );

  if (
    !data.message ||
    !data.nonce ||
    !data.wallet_address
  ) {
    throw new Error(
      "history_challenge_incomplete"
    );
  }

  return data;
}


export async function getWalletPayoutHistory({
  connectSessionId,
  nonce,
  signature,
  limit = 20
}) {
  const normalizedConnectSessionId =
    String(
      connectSessionId ||
      ""
    ).trim();

  const normalizedNonce =
    String(
      nonce ||
      ""
    ).trim();

  const normalizedSignature =
    String(
      signature ||
      ""
    ).trim();

  if (
    !normalizedConnectSessionId
  ) {
    throw new Error(
      "connect_session_id_required"
    );
  }

  if (!normalizedNonce) {
    throw new Error(
      "history_authorization_nonce_required"
    );
  }

  if (!normalizedSignature) {
    throw new Error(
      "history_authorization_signature_required"
    );
  }

  const response =
    await fetch(
      `${API_BASE}/connect/payout-history/wallet`,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            connect_session_id:
              normalizedConnectSessionId,

            nonce:
              normalizedNonce,

            signature:
              normalizedSignature,

            limit:
              normalizeHistoryLimit(
                limit
              )
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
    "get_wallet_payout_history_failed"
  );

  return projectHistoryResponse(
    data
  );
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
