// unibrij/unibridge-landing/surface/return-url.js

export function buildFundingReturnUrl(targetSessionId) {
  if (!targetSessionId) {
    return null;
  }

  try {
    const url = new URL(window.location.href);

    url.searchParams.delete("settlement_id");
    url.searchParams.set("session_id", targetSessionId);
    url.searchParams.set("return", "funding");

    return url.toString();
  } catch {
    return null;
  }
}

export function getSessionIdFromUrl() {
  try {
    const url = new URL(window.location.href);
    const value = url.searchParams.get("session_id");

    return value && value.trim()
      ? value.trim()
      : null;
  } catch {
    return null;
  }
}

export function isFundingReturn() {
  try {
    const url = new URL(window.location.href);

    return url.searchParams.get("return") === "funding";
  } catch {
    return false;
  }
}

export function cleanupFundingReturnUrl() {
  try {
    const url = new URL(window.location.href);

    url.searchParams.delete("session_id");
    url.searchParams.delete("settlement_id");
    url.searchParams.delete("return");

    window.history.replaceState(
      {},
      document.title,
      url.toString()
    );
  } catch {
    // no-op
  }
}
