// pay-by-bank/js/flow/returnIdentity.js

import {
  normalizeString
} from "./normalization.js";


const RETURN_STORAGE_KEYS =
  Object.freeze({
    settlementId:
      "unibridge.pay_by_bank.settlement_id",

    sessionId:
      "unibridge.pay_by_bank.session_id"
  });


export function buildFundingReturnUrl(
  sessionId
) {
  const normalizedSessionId =
    normalizeString(
      sessionId
    );

  if (!normalizedSessionId) {
    throw new Error(
      "missing_session_id_for_return_url"
    );
  }

  const url =
    new URL(
      window.location.href
    );

  url.searchParams.delete(
    "settlement_id"
  );

  url.searchParams.set(
    "session_id",
    normalizedSessionId
  );

  url.searchParams.set(
    "return",
    "funding"
  );

  return url.toString();
}


export function persistReturnIdentity({
  settlementId,
  sessionId
} = {}) {
  try {
    const normalizedSettlementId =
      normalizeString(
        settlementId
      );

    const normalizedSessionId =
      normalizeString(
        sessionId
      );

    if (
      normalizedSettlementId
    ) {
      window
        .sessionStorage
        .setItem(
          RETURN_STORAGE_KEYS
            .settlementId,
          normalizedSettlementId
        );
    } else {
      window
        .sessionStorage
        .removeItem(
          RETURN_STORAGE_KEYS
            .settlementId
        );
    }

    if (
      normalizedSessionId
    ) {
      window
        .sessionStorage
        .setItem(
          RETURN_STORAGE_KEYS
            .sessionId,
          normalizedSessionId
        );
    } else {
      window
        .sessionStorage
        .removeItem(
          RETURN_STORAGE_KEYS
            .sessionId
        );
    }
  } catch {
    /*
    Storage is recovery assistance only.

    Failure to persist must not prevent the payment
    handoff from continuing.
    */
  }
}


export function readReturnIdentity() {
  try {
    return {
      settlementId:
        normalizeString(
          window
            .sessionStorage
            .getItem(
              RETURN_STORAGE_KEYS
                .settlementId
            )
        ) ||
        null,

      sessionId:
        normalizeString(
          window
            .sessionStorage
            .getItem(
              RETURN_STORAGE_KEYS
                .sessionId
            )
        ) ||
        null
    };
  } catch {
    return {
      settlementId:
        null,

      sessionId:
        null
    };
  }
}


export function clearReturnIdentity() {
  try {
    window
      .sessionStorage
      .removeItem(
        RETURN_STORAGE_KEYS
          .settlementId
      );

    window
      .sessionStorage
      .removeItem(
        RETURN_STORAGE_KEYS
          .sessionId
      );
  } catch {
    // no-op
  }
}
