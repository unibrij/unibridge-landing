// fiat/bank-transfer/js/clerkAuth.js

const FIAT_CUSTOMER_PROFILE_KEY =
  "unibridge_fiat_customer_profile";

const AUTH_BRIDGE_KEY =
  "__fiatClerkAuth";

const AUTH_EVENT =
  "fiat-clerk-auth-updated";

const DEFAULT_TIMEOUT_MS =
  5 * 60 * 1000;

function normalizeString(value) {
  return String(value || "").trim();
}

function readAuthBridge() {
  return window[AUTH_BRIDGE_KEY] || null;
}

function readTransientCustomerProfile() {
  const raw =
    window.sessionStorage.getItem(
      FIAT_CUSTOMER_PROFILE_KEY
    );

  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function writeTransientCustomerProfile(values = {}) {
  const existing =
    readTransientCustomerProfile();

  const next = {
    ...existing
  };

  const email =
    normalizeString(values.email);

  if (email) {
    next.email =
      email;
  }

  window.sessionStorage.setItem(
    FIAT_CUSTOMER_PROFILE_KEY,
    JSON.stringify(next)
  );

  return next;
}

export {
  readTransientCustomerProfile
};

export function clearTransientCustomerProfile() {
  window.sessionStorage.removeItem(
    FIAT_CUSTOMER_PROFILE_KEY
  );
}

function isBridgeLoaded(bridge) {
  return Boolean(
    bridge &&
    bridge.isLoaded
  );
}

function isBridgeSignedIn(bridge) {
  return Boolean(
    isBridgeLoaded(bridge) &&
    bridge.isSignedIn &&
    typeof bridge.getToken === "function"
  );
}

function resolveBridgeEmail(bridge) {
  return (
    normalizeString(
      bridge?.email
    ) ||
    normalizeString(
      readTransientCustomerProfile().email
    ) ||
    null
  );
}

function waitForAuthBridge({
  requireSignedIn = false,
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  return new Promise((resolve, reject) => {
    const startedAt =
      Date.now();

    let interval = null;

    function cleanup() {
      window.removeEventListener(
        AUTH_EVENT,
        check
      );

      if (interval) {
        window.clearInterval(
          interval
        );
      }
    }

    function matches(bridge) {
      if (requireSignedIn) {
        return isBridgeSignedIn(
          bridge
        );
      }

      return isBridgeLoaded(
        bridge
      );
    }

    function check() {
      const bridge =
        readAuthBridge();

      if (matches(bridge)) {
        cleanup();

        resolve(
          bridge
        );

        return;
      }

      if (
        Date.now() - startedAt >
        timeoutMs
      ) {
        cleanup();

        reject(
          new Error(
            requireSignedIn
              ? "clerk_sign_in_timeout"
              : "clerk_load_timeout"
          )
        );
      }
    }

    window.addEventListener(
      AUTH_EVENT,
      check
    );

    interval =
      window.setInterval(
        check,
        250
      );

    check();
  });
}

export async function loadClerk() {
  return waitForAuthBridge({
    requireSignedIn:
      false
  });
}

export async function ensureFiatClerkAuth() {
  const bridge =
    await waitForAuthBridge({
      requireSignedIn:
        true
    });

  const token =
    await bridge.getToken();

  if (!token) {
    throw new Error(
      "clerk_session_token_missing"
    );
  }

  const email =
    resolveBridgeEmail(
      bridge
    );

  if (!email) {
    throw new Error(
      "clerk_email_missing"
    );
  }

  writeTransientCustomerProfile({
    email
  });

  return {
    ok:
      true,

    provider:
      "clerk",

    token,

    user_id:
      null,

    email,

    email_verified:
      true
  };
}

export async function getFiatClerkToken() {
  const auth =
    await ensureFiatClerkAuth();

  return auth.token;
}

export async function buildClerkAuthorizationHeader() {
  const token =
    await getFiatClerkToken();

  return {
    Authorization:
      `Bearer ${token}`
  };
}
