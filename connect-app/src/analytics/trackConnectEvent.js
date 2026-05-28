// connect-app/src/analytics/trackConnectEvent.js

const SESSION_KEY = "unibridge_connect_session_id";

function createId(prefix = "id") {
  if (
    typeof crypto !== "undefined" &&
    crypto.randomUUID
  ) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2)}`;
}

function getSessionId() {
  if (typeof localStorage === "undefined") {
    return createId("sess");
  }

  try {
    let sessionId = localStorage.getItem(SESSION_KEY);

    if (!sessionId) {
      sessionId = createId("sess");
      localStorage.setItem(SESSION_KEY, sessionId);
    }

    return sessionId;
  } catch {
    return createId("sess");
  }
}

async function sha256(value) {
  if (!value) return null;

  if (
    typeof crypto === "undefined" ||
    !crypto.subtle
  ) {
    return null;
  }

  try {
    const encoded = new TextEncoder().encode(
      String(value).trim().toLowerCase()
    );

    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      encoded
    );

    return Array.from(new Uint8Array(hashBuffer))
      .map(byte => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

function getSafePageUrl() {
  if (typeof window === "undefined") {
    return null;
  }

  return `${window.location.origin}${window.location.pathname}`;
}

export async function trackConnectEvent(name, payload = {}) {
  const event = {
    event_id: createId("evt"),
    source: "connect_app",
    name,
    session_id: getSessionId(),
    wallet_address_hash: await sha256(payload.wallet_address),
    wallet_provider: payload.wallet_provider || null,
    route_id: payload.route_id || null,
    asset: payload.asset || null,
    timestamp: new Date().toISOString(),
    page_path:
      typeof window !== "undefined"
        ? window.location.pathname
        : null,
    page_url: getSafePageUrl(),
    metadata: payload.metadata || {}
  };

  console.log("[connect_event]", event);

  return event;
}
