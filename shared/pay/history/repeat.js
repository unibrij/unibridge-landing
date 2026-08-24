// shared/pay/history/repeat.js

import {
  normalizeString,
  getRepeatPayoutSource
} from "./history.js";

import {
  getFiatClerkToken
} from "/shared/pay/auth/clerkAuth.js";


export function getRepeatSourceSettlementId() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  return (
    normalizeString(
      params.get(
        "repeat_source_settlement_id"
      )
    ) ||
    null
  );
}


export function isRepeatPayoutEntry() {
  return Boolean(
    getRepeatSourceSettlementId()
  );
}


export async function loadRepeatPayoutSource({
  partner
}) {
  const sourceSettlementId =
    getRepeatSourceSettlementId();

  if (!sourceSettlementId) {
    return null;
  }

  const accessToken =
    await getFiatClerkToken();

  return getRepeatPayoutSource({
    partner,
    sourceSettlementId,
    accessToken
  });
}
