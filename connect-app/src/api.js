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

function resolveErrorMessage(
  data,
  fallback
) {
  if (
    typeof data?.error ===
    "string"
  ) {
    return (
      data.error ||
      fallback
    );
  }

  return (
    data?.error?.code ||
    data?.error?.message ||
    fallback
  );
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
      resolveErrorMessage(
        data,
        fallback
      )
    );
  }
}

function buildCustomerAuthHeaders(
  accessToken
) {
  const normalizedAccessToken =
    String(
      accessToken ||
      ""
    ).trim();

  if (
    !normalizedAccessToken
  ) {
    throw new Error(
      "customer_access_token_required"
    );
  }

  return {
    "Content-Type":
      "application/json",

    Authorization:
      `Bearer ${normalizedAccessToken}`
  };
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
  source = "reown"
}) {
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

        body:
          JSON.stringify({
            wallet_address:
              walletAddress,

            chain_id:
              chainId ||
              137,

            source
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

  return data;
}

export async function previewConnectRoute({
  connectSessionId,
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

export async function createPayoutIntent({
  connectSessionId,
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

export async function downloadReceiptPdf({
  receiptId,
  accessToken
}) {
  const normalizedReceiptId =
    String(
      receiptId ||
      ""
    ).trim();

  const normalizedAccessToken =
    String(
      accessToken ||
      ""
    ).trim();

  if (!normalizedReceiptId) {
    throw new Error(
      "receipt_id_required"
    );
  }

  if (!normalizedAccessToken) {
    throw new Error(
      "receipt_access_token_required"
    );
  }

  const response =
    await fetch(
      `${API_BASE}/receipts/${encodeURIComponent(
        normalizedReceiptId
      )}/pdf`,
      {
        method:
          "GET",

        headers: {
          Authorization:
            `Bearer ${normalizedAccessToken}`
        }
      }
    );

  if (!response.ok) {
    const data =
      await parseJson(
        response
      );

    throw new Error(
      resolveErrorMessage(
        data,
        "receipt_download_failed"
      )
    );
  }

  const contentType =
    String(
      response.headers.get(
        "content-type"
      ) ||
      ""
    ).toLowerCase();

  if (
    !contentType.includes(
      "application/pdf"
    )
  ) {
    throw new Error(
      "receipt_pdf_response_invalid"
    );
  }

  const blob =
    await response.blob();

  if (!blob.size) {
    throw new Error(
      "receipt_pdf_empty"
    );
  }

  const contentDisposition =
    String(
      response.headers.get(
        "content-disposition"
      ) ||
      ""
    );

  const filenameMatch =
    contentDisposition.match(
      /filename\*?=(?:UTF-8''|")?([^";]+)/i
    );

  let filename =
    `unibridge-receipt-${normalizedReceiptId}.pdf`;

  if (filenameMatch?.[1]) {
    try {
      filename =
        decodeURIComponent(
          filenameMatch[1]
            .replace(
              /^"|"$/g,
              ""
            )
            .trim()
        );
    }
    catch {
      filename =
        filenameMatch[1]
          .replace(
            /^"|"$/g,
            ""
          )
          .trim() ||
        filename;
    }
  }

  return {
    blob,
    filename
  };
}
