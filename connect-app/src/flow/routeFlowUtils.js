// connect-app/src/flow/routeFlowUtils.js

export function normalizeStatus(
  status = ""
) {
  return String(
    status || ""
  )
    .trim()
    .toLowerCase();
}

export function isCompletedStatus(
  status = ""
) {
  return [
    "payout_completed"
  ].includes(
    normalizeStatus(
      status
    )
  );
}

export function isTerminalFailureStatus(
  status = ""
) {
  return [
    "failed",
    "failure",
    "cancelled",
    "canceled",
    "expired",
    "rejected",
    "payout_failed",
    "execution_failed"
  ].includes(
    normalizeStatus(
      status
    )
  );
}

export function getSettlementId(
  settlement
) {
  return (
    settlement?.settlement_id ||
    settlement?.id ||
    settlement?.route_id ||
    "N/A"
  );
}

export function pickSettlementLike(
  intent
) {
  return {
    ...intent,

    settlement_id:
      intent?.settlement_id ||
      null,

    status:
      intent?.public_route_status ||
      intent?.live_settlement_status ||
      intent?.settlement_status ||
      intent?.status ||
      null,

    settlement_status:
      intent?.settlement_status ||
      null,

    live_settlement_status:
      intent?.live_settlement_status ||
      null,

    public_route_status:
      intent?.public_route_status ||
      null
  };
}

export function getPayoutIntentId(
  result
) {
  return (
    result?.payout_intent_id ||
    result
      ?.payout_intent
      ?.payout_intent_id ||
    result
      ?.payout_intent
      ?.id ||
    result?.id ||
    null
  );
}

export function normalizePricingPreview(
  pricingPreview
) {
  return (
    pricingPreview
      ?.pricing_preview ??
    pricingPreview ??
    null
  );
}

export function sleep(
  ms
) {
  return new Promise(
    resolve => {
      globalThis.setTimeout(
        resolve,
        ms
      );
    }
  );
}
