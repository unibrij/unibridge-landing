// connect-app/src/api.js

const API_BASE =
  "https://unibridge-v2-vqia6yp7wq-uc.a.run.app/v2";

async function parseJson(
  response
) {
  return response
    .json()
    .catch(() => ({}));
}

function assertOk(
  response,
  data,
  fallback
) {
  if (
    !response.ok ||
    !data?.ok
  ) {
    throw new Error(
      data?.error ||
      fallback
    );
  }
}

export async function getConnectRoutes() {
  const response =
    await fetch(
      `${API_BASE}/connect/routes`,
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
    "get_connect_routes_failed"
  );

  return Array.isArray(
    data.routes
  )
    ? data.routes
    : [];
}

export async function createConnectSession({
  walletAddress,
  chainId,
  caipAddress = null,
  embeddedWallet = null,
  accounts = [],
  source = "reown"
}) {
  if (!walletAddress) {
    throw new Error(
      "wallet_address_required"
    );
  }

  if (
    chainId === null ||
    chainId === undefined
  ) {
    throw new Error(
      "wallet_chain_required"
    );
  }

  const response =
    await fetch(
      `${API_BASE}/connect/session`,
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
          JSON.stringify({
            source,

            wallet_address:
              walletAddress,

            chain_id:
              chainId,

            caip_address:
              caipAddress,

            embedded_wallet:
              embeddedWallet,

            accounts:
              Array.isArray(
                accounts
              )
                ? accounts
                : []
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
    "connect_session_failed"
  );

  if (
    !data.connect_session_id ||
    !data.connect_session_secret
  ) {
    throw new Error(
      "connect_session_credential_missing"
    );
  }

  return data;
}

export async function createSiwxChallenge({
  connectSessionId,
  connectSessionSecret,
  address,
  chainId
}) {
  const response =
    await fetch(
      `${API_BASE}/connect/auth/siwx/challenge`,
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
          JSON.stringify({
            connect_session_id:
              connectSessionId,

            connect_session_secret:
              connectSessionSecret,

            address,

            chain_id:
              chainId
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
    "siwx_challenge_failed"
  );

  if (
    !data.challenge_id ||
    typeof data.message !==
      "string" ||
    !data.message
  ) {
    throw new Error(
      "siwx_challenge_invalid"
    );
  }

  return data;
}

export async function verifySiwxChallenge({
  connectSessionId,
  connectSessionSecret,
  challengeId,
  message,
  signature
}) {
  const response =
    await fetch(
      `${API_BASE}/connect/auth/siwx/verify`,
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
          JSON.stringify({
            connect_session_id:
              connectSessionId,

            connect_session_secret:
              connectSessionSecret,

            challenge_id:
              challengeId,

            message,

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
    "siwx_verification_failed"
  );

  if (
    data.auth_status !==
    "authenticated"
  ) {
    throw new Error(
      "siwx_authentication_failed"
    );
  }

  return data;
}

export async function previewConnectRoute({
  connectSessionId,
  connectSessionSecret,
  walletAddress,
  route,
  amount,
  asset,
  executionAsset,
  executionNetwork
}) {
  if (!route) {
    throw new Error(
      "connect_route_required"
    );
  }

  const fundingAsset =
    asset ??
    route.asset;

  if (!fundingAsset) {
    throw new Error(
      "funding_asset_required"
    );
  }

  const response =
    await fetch(
      `${API_BASE}/connect/pricing-preview`,
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
              connectSessionId,

            connect_session_secret:
              connectSessionSecret,

            wallet_address:
              walletAddress,

            country:
              route.country,

            rail:
              route.rail,

            network:
              route.network,

            asset:
              fundingAsset,

            amount,

            execution_asset:
              executionAsset ??
              route.execution_asset,

            execution_network:
              executionNetwork ??
              route.execution_network
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
    "connect_pricing_preview_failed"
  );

  if (!data.pricing_preview) {
    throw new Error(
      "pricing_preview_missing"
    );
  }

  return data;
}

export async function startKyc({
  connectSessionId,
  connectSessionSecret,
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
            connectSessionId,

          connect_session_secret:
            connectSessionSecret
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

export async function createPayoutIntent({
  connectSessionId,
  connectSessionSecret,
  walletAddress,
  route,
  form
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
          JSON.stringify({
            connect_session_id:
              connectSessionId,

            connect_session_secret:
              connectSessionSecret,

            wallet_address:
              walletAddress,

            country:
              route.country,

            rail:
              route.rail,

            amount:
              form.amount,

            asset:
              fundingAsset,

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

export async function getWalletPayoutHistory({
  walletAddress,
  limit = 20
}) {
  const params =
    new URLSearchParams({
      wallet_address:
        walletAddress,

      limit:
        String(
          limit
        )
    });

  const response =
    await fetch(
      `${API_BASE}/connect/payout-history?${params.toString()}`,
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
    "get_wallet_payout_history_failed"
  );

  return Array.isArray(
    data.items
  )
    ? data.items
    : [];
}

export async function submitWalletFundingTx(
  payload
) {
  const response =
    await fetch(
      `${API_BASE}/connect/submit-wallet-tx`,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(
            payload
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
    "submit_wallet_tx_failed"
  );

  return data;
}
