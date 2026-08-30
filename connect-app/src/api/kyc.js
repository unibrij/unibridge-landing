// connect-app/src/api/kyc.js

import {
  API_BASE,
  assertOk,
  parseJson
} from "./client.js";


export async function startKyc({
  connectSessionId,
  payoutIntentId
}) {
  const hasConnectSessionId =
    Boolean(
      connectSessionId
    );

  const hasPayoutIntentId =
    Boolean(
      payoutIntentId
    );

  if (
    hasConnectSessionId ===
    hasPayoutIntentId
  ) {
    throw new Error(
      "exactly_one_kyc_subject_required"
    );
  }

  const requestBody =
    hasConnectSessionId
      ? {
          connect_session_id:
            connectSessionId
        }
      : {
          payout_intent_id:
            payoutIntentId
        };

  const response =
    await fetch(
      `${API_BASE}/connect/kyc`,
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
    "kyc_session_failed"
  );

  if (
    !data.skipped &&
    !data.url
  ) {
    throw new Error(
      "kyc_url_missing"
    );
  }

  return data;
}


export async function getKycStatus({
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

  const params =
    new URLSearchParams({
      connect_session_id:
        normalizedConnectSessionId
    });

  const response =
    await fetch(
      `${API_BASE}/connect/kyc?${params.toString()}`,
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
    "get_kyc_status_failed"
  );

  const kycStatus =
    String(
      data.kyc_status ||
      ""
    )
      .trim()
      .toLowerCase();

  if (!kycStatus) {
    throw new Error(
      "kyc_status_missing"
    );
  }

  return {
    connect_session_id:
      data.connect_session_id ||
      normalizedConnectSessionId,

    kyc_status:
      kycStatus
  };
}
