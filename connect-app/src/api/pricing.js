// connect-app/src/api/pricing.js

import {
  API_BASE,
  assertOk,
  parseJson
} from "./client.js";


export async function previewConnectRoute({
  connectSessionId,
  walletAddress,
  route,
  amount,
  asset,
  executionAsset,
  executionNetwork,
  receiveProfileId = null
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

  const normalizedReceiveProfileId =
    String(
      receiveProfileId ||
      ""
    ).trim() ||
    null;

  const requestBody = {
    connect_session_id:
      connectSessionId,

    wallet_address:
      walletAddress,

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
  };

  /*
   * Standard Connect owns country / rail through the
   * selected route.
   *
   * Receive destination authority belongs to Core.
   * In Receive mode the browser supplies only the
   * Receive profile reference.
   */
  if (
    normalizedReceiveProfileId
  ) {
    requestBody.receive_profile_id =
      normalizedReceiveProfileId;
  }
  else {
    requestBody.country =
      route.country;

    requestBody.rail =
      route.rail;
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
    "connect_pricing_preview_failed"
  );

  if (!data.pricing_preview) {
    throw new Error(
      "pricing_preview_missing"
    );
  }

  return data;
}
