// connect-app/src/api/account.js

import {
  API_BASE,
  assertOk,
  parseJson
} from "./client.js";


export async function requestAccountDeletionMessage({
  walletAddress
} = {}) {
  const response =
    await fetch(
      `${API_BASE}/connect/account-delete/message`,
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
              walletAddress
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
    "account_deletion_message_failed"
  );

  return data;
}


export async function submitAccountDeletion({
  walletAddress,
  message,
  nonce,
  signature
} = {}) {
  const response =
    await fetch(
      `${API_BASE}/connect/account-delete/submit`,
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
    "account_deletion_submit_failed"
  );

  return data;
}
