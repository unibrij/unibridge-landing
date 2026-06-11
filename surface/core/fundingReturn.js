// unibrij/unibridge-landing/surface/core/fundingReturn.js

/*
--------------------------------------------------
Surface Funding Return Helpers

Purpose:
- keep funding return URL logic outside app.js
- preserve current ramp return behavior
- avoid settlement resume from stale return params

Query params used:
- session_id
- settlement_id
- return=funding
--------------------------------------------------
*/

function getCurrentUrl() {
  try {
    return new URL(
      window.location.href
    );
  } catch {
    return null;
  }
}

function normalizeString(value) {
  return String(value || "").trim();
}

export function buildFundingReturnUrl(targetSessionId) {
  const sessionId =
    normalizeString(targetSessionId);

  if (!sessionId) {
    return null;
  }

  const url =
    getCurrentUrl();

  if (!url) {
    return null;
  }

  url.searchParams.delete("settlement_id");
  url.searchParams.set("session_id", sessionId);
  url.searchParams.set("return", "funding");

  return url.toString();
}

export function getSessionIdFromUrl() {
  const url =
    getCurrentUrl();

  if (!url) {
    return null;
  }

  const value =
    normalizeString(
      url.searchParams.get("session_id")
    );

  return value || null;
}

export function getSettlementIdFromUrl() {
  const url =
    getCurrentUrl();

  if (!url) {
    return null;
  }

  const value =
    normalizeString(
      url.searchParams.get("settlement_id")
    );

  return value || null;
}

export function isFundingReturn() {
  const url =
    getCurrentUrl();

  if (!url) {
    return false;
  }

  return (
    normalizeString(
      url.searchParams.get("return")
    ) === "funding"
  );
}

export function cleanupFundingReturnUrl() {
  const url =
    getCurrentUrl();

  if (!url) {
    return false;
  }

  url.searchParams.delete("session_id");
  url.searchParams.delete("settlement_id");
  url.searchParams.delete("return");

  try {
    window.history.replaceState(
      {},
      document.title,
      url.toString()
    );

    return true;
  } catch {
    return false;
  }
}

export function shouldResetAfterFundingReturn() {
  return Boolean(
    getSessionIdFromUrl() &&
      isFundingReturn()
  );
}
