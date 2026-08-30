// connect-app/src/api/session.js

import {
  API_BASE,
  assertOk,
  parseJson
} from "./client.js";


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
