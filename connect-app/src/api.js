// connect-app/src/api.js

const API_BASE =
  "https://unibridge-v2-vqia6yp7wq-uc.a.run.app/v2";

async function parseJson(response) {
  return response.json().catch(() => ({}));
}

async function assertOk(response, data, fallback) {
  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || fallback);
  }
}

export async function createConnectSession({
  walletAddress,
  chainId,
  source = "reown"
}) {
  const response = await fetch(
    `${API_BASE}/connect/session`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        wallet_address: walletAddress,
        chain_id: chainId || 137,
        source
      })
    }
  );

  const data =
    await parseJson(response);

  await assertOk(
    response,
    data,
    "connect_session_failed"
  );

  return data;
}

export async function createPayoutIntent({
  connectSessionId,
  walletAddress,
  route,
  form
}) {
  const response = await fetch(
    `${API_BASE}/connect/payout-intent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        connect_session_id:
          connectSessionId,

        wallet_address:
          walletAddress,

        country:
          route.country,

        rail:
          route.rail,

        amount:
          form.amount,

        asset:
          form.asset,

        network:
          route.network,

        beneficiary: {
          rail:
            route.rail,

          country:
            route.country,

          ...form.beneficiary
        }
      })
    }
  );

  const data =
    await parseJson(response);

  await assertOk(
    response,
    data,
    "payout_intent_failed"
  );

  return data;
}

export async function requestAuthorizationMessage({
  payoutIntentId
}) {
  const response = await fetch(
    `${API_BASE}/connect/payout-authorize/message`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        payout_intent_id:
          payoutIntentId
      })
    }
  );

  const data =
    await parseJson(response);

  await assertOk(
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
  const response = await fetch(
    `${API_BASE}/connect/payout-authorize/submit`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        payout_intent_id:
          payoutIntentId,

        message,
        nonce,
        signature
      })
    }
  );

  const data =
    await parseJson(response);

  await assertOk(
    response,
    data,
    "authorization_submit_failed"
  );

  return data;
}

export async function startKyc({
  payoutIntentId
}) {
  const response = await fetch(
    `${API_BASE}/connect/kyc`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        payout_intent_id:
          payoutIntentId
      })
    }
  );

  const data =
    await parseJson(response);

  await assertOk(
    response,
    data,
    "kyc_session_failed"
  );

  if (!data.url) {
    throw new Error("kyc_url_missing");
  }

  return data;
}
