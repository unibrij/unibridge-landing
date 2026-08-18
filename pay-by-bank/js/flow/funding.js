// pay-by-bank/js/flow/funding.js

import {
  createSettlement,
  getFundingSession,
  createRampOrder,
  extractSettlementId,
  extractNextAction,
  extractRedirectUrl,
  extractTransactionId
} from "../api.js";

import {
  buildFundingReturnUrl
} from "./returnIdentity.js";

import {
  normalizeString
} from "./normalization.js";


export async function ensureSettlement({
  sessionId,
  routeId,
  destination,
  existingSettlementId
}) {
  const existing =
    normalizeString(
      existingSettlementId
    );

  if (existing) {
    return {
      settlementId:
        existing,

      created:
        false
    };
  }

  const redirectUrl =
    buildFundingReturnUrl(
      sessionId
    );

  const created =
    await createSettlement({
      session_id:
        sessionId,

      route_id:
        routeId,

      destination,

      redirect_url:
        redirectUrl
    });

  const settlementId =
    extractSettlementId(
      created
    );

  if (!settlementId) {
    throw new Error(
      "settlement_id_missing"
    );
  }

  return {
    settlementId,

    created:
      true
  };
}


/*
--------------------------------------------------
Prepare funding redirect
--------------------------------------------------

The funding session is prepared first so the
canonical sender-side funding target and provider
metadata exist durably.

WhiteLabel Pay-by-Bank provider mutation then runs
through the existing post-persistence ramp order
command.

The redirect next_action therefore belongs to the
order result, not to the funding-session result.
--------------------------------------------------
*/

export async function prepareFundingRedirect(
  settlementId
) {
  const normalizedSettlementId =
    normalizeString(
      settlementId
    );

  if (!normalizedSettlementId) {
    throw new Error(
      "settlement_id_missing"
    );
  }

  /*
  --------------------------------------------------
  Funding-session preparation
  --------------------------------------------------
  */

  const funding =
    await getFundingSession({
      settlement_id:
        normalizedSettlementId
    });

  /*
  --------------------------------------------------
  Post-persistence provider order
  --------------------------------------------------
  */

  const order =
    await createRampOrder({
      settlement_id:
        normalizedSettlementId
    });

  const transactionId =
    extractTransactionId(
      order
    );

  const nextAction =
    extractNextAction(
      order
    );

  const redirectUrl =
    extractRedirectUrl(
      order
    );

  const nextActionType =
    normalizeString(
      nextAction?.type
    ).toLowerCase();

  if (
    !redirectUrl ||
    (
      nextActionType &&
      nextActionType !==
        "redirect"
    )
  ) {
    throw new Error(
      "pay_by_bank_redirect_missing"
    );
  }

  return {
    funding,
    order,
    transactionId,
    nextAction,
    redirectUrl
  };
}
