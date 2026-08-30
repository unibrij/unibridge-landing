// connect-app/src/api/funding.js

import {
  API_BASE,
  assertOk,
  buildCustomerAuthHeaders,
  parseJson,
  resolveErrorMessage
} from "./client.js";


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


export async function authorizeFunding({
  settlementId,
  authorization,
  signature,
  accessToken
}) {
  const normalizedSettlementId =
    String(
      settlementId ||
      ""
    ).trim();

  const nonce =
    String(
      authorization?.nonce ??
      ""
    ).trim();

  const normalizedSignature =
    String(
      signature ||
      ""
    ).trim();

  if (
    !normalizedSettlementId
  ) {
    throw new Error(
      "missing_authorized_funding_identity"
    );
  }

  if (!nonce) {
    throw new Error(
      "missing_authorized_funding_nonce"
    );
  }

  if (
    !normalizedSignature
  ) {
    throw new Error(
      "missing_authorized_funding_signature"
    );
  }

  const requestBody = {
    settlement_id:
      normalizedSettlementId,

    nonce,

    signature:
      normalizedSignature
  };

  if (
    authorization?.validAfter !==
      undefined &&
    authorization?.validAfter !==
      null &&
    authorization?.validAfter !==
      ""
  ) {
    requestBody.validAfter =
      String(
        authorization.validAfter
      );
  }

  if (
    authorization?.validBefore !==
      undefined &&
    authorization?.validBefore !==
      null &&
    authorization?.validBefore !==
      ""
  ) {
    requestBody.validBefore =
      String(
        authorization.validBefore
      );
  }

  const response =
    await fetch(
      `${API_BASE}/funding/authorized`,
      {
        method:
          "POST",

        headers:
          buildCustomerAuthHeaders(
            accessToken
          ),

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

  if (!response.ok) {
    throw new Error(
      resolveErrorMessage(
        data,
        "authorized_funding_failed"
      )
    );
  }

  if (
    data.mode !==
      "authorized" ||
    typeof data.tx_hash !==
      "string" ||
    !data.tx_hash ||
    Number(
      data.chain_id
    ) !== 137
  ) {
    throw new Error(
      "authorized_funding_response_invalid"
    );
  }

  return {
    mode:
      data.mode,

    tx_hash:
      data.tx_hash,

    chain_id:
      Number(
        data.chain_id
      )
  };
}
