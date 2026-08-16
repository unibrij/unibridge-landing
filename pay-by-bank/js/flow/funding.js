// pay-by-bank/js/flow/funding.js

import {
  createSettlement,
  getFundingSession,
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

  const funding =
    await getFundingSession({
      settlement_id:
        normalizedSettlementId
    });

  const transactionId =
    extractTransactionId(
      funding
    );

  const nextAction =
    extractNextAction(
      funding
    );

  const redirectUrl =
    extractRedirectUrl(
      funding
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
    transactionId,
    nextAction,
    redirectUrl
  };
}
