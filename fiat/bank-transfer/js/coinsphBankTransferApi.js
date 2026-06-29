// fiat/bank-transfer/js/coinsphBankTransferApi.js

import {
  normalizeOptionsPayload
} from "../../../shared/coinsph/coinsph-options.js";

const COINSPH_PAYOUT_CHANNELS_ENDPOINT =
  "surface/options/coinsph/ph-payout-channels";

function buildProxyUrl(endpoint) {
  return (
    "/api/proxy?partner=fiat_bank_transfer&endpoint=" +
    encodeURIComponent(endpoint)
  );
}

export async function loadCoinsPhBankTransferChannelOptions() {
  const response =
    await fetch(
      buildProxyUrl(
        COINSPH_PAYOUT_CHANNELS_ENDPOINT
      ),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body:
          "{}"
      }
    );

  const payload =
    await response.json().catch(() => ({}));

  if (!response.ok || payload?.ok === false) {
    throw new Error(
      payload?.error ||
        "COINSPH_CHANNELS_LOAD_FAILED"
    );
  }

  return normalizeOptionsPayload(
    payload
  );
}
