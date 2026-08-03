// connect/api.js

export const API_BASE =
  "https://unibridge-v2-vqia6yp7wq-uc.a.run.app/v2";

async function readJson(
  response
) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function requestJson(
  path,
  body
) {
  const response =
    await fetch(
      `${API_BASE}${path}`,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        cache:
          "no-store",

        body:
          JSON.stringify(
            body
          )
      }
    );

  const data =
    await readJson(
      response
    );

  if (
    !response.ok ||
    !data?.ok
  ) {
    const error =
      new Error(
        data?.error ||
        "request_failed"
      );

    error.status =
      response.status;

    error.payload =
      data;

    throw error;
  }

  return data;
}

export function createConnectSession(
  payload
) {
  return requestJson(
    "/connect/session",
    payload
  );
}

export function createSiwxChallenge({
  connectSessionId,
  connectSessionSecret,
  address,
  chainId
}) {
  return requestJson(
    "/connect/auth/siwx/challenge",
    {
      connect_session_id:
        connectSessionId,

      connect_session_secret:
        connectSessionSecret,

      address,

      chain_id:
        chainId
    }
  );
}

export function verifySiwxChallenge({
  connectSessionId,
  connectSessionSecret,
  challengeId,
  message,
  signature
}) {
  return requestJson(
    "/connect/auth/siwx/verify",
    {
      connect_session_id:
        connectSessionId,

      connect_session_secret:
        connectSessionSecret,

      challenge_id:
        challengeId,

      message,

      signature
    }
  );
}

export function createPayoutIntent(
  payload
) {
  return requestJson(
    "/connect/payout-intent",
    payload
  );
}
