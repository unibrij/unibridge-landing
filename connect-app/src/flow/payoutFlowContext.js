// connect-app/src/flow/payoutFlowContext.js

import {
  validateRouteForm
} from "../form";

import {
  buildTransferFingerprint
} from "./payoutAttempt";

export function normalizeAuthorizationStatus(
  value
) {
  return String(
    value ||
    ""
  )
    .trim()
    .toLowerCase();
}

export function requireNormalFlowContext({
  connectSessionId,
  selectedRoute,
  address,
  form
}) {
  if (!connectSessionId) {
    throw new Error(
      "connect_session_required"
    );
  }

  if (!selectedRoute) {
    throw new Error(
      "connect_route_required"
    );
  }

  if (!address) {
    throw new Error(
      "wallet_address_required"
    );
  }

  validateRouteForm({
    form,

    route:
      selectedRoute
  });
}

export function requireRepeatFlowContext({
  connectSessionId,
  repeatSourcePayoutIntentId,
  repeatAccessToken,
  form
}) {
  if (!connectSessionId) {
    throw new Error(
      "connect_session_required"
    );
  }

  if (
    !repeatSourcePayoutIntentId
  ) {
    throw new Error(
      "repeat_source_payout_intent_id_required"
    );
  }

  if (!repeatAccessToken) {
    throw new Error(
      "repeat_access_token_required"
    );
  }

  const amount =
    Number(
      form?.amount
    );

  if (
    !Number.isFinite(
      amount
    ) ||
    amount <= 0
  ) {
    throw new Error(
      "invalid_amount"
    );
  }
}

export function buildCurrentTransferFingerprint({
  selectedRoute,
  form,
  repeatSourcePayoutIntentId
}) {
  return buildTransferFingerprint({
    route:
      selectedRoute,

    form,

    repeatSourcePayoutIntentId:
      repeatSourcePayoutIntentId ||
      null
  });
}
