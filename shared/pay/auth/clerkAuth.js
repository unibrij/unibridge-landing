// shared/pay/auth/clerkAuth.js

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

function writeTransientCustomerProfile(
  values = {}
) {
  const existing =
    readTransientCustomerProfile();

  const next = {
    ...existing
  };

  const email =
    normalizeString(
      values.email
    );

  const authSubjectId =
    normalizeString(
      values.auth_subject_id ||
      values.user_id
    );

  if (email) {
    next.email =
      email;
  }

  if (authSubjectId) {
    next.auth_provider =
      "clerk";

    next.auth_subject_id =
      authSubjectId;

    next.user_id =
      authSubjectId;
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

function isBridgeLoaded(
  bridge
) {
  return Boolean(
    bridge &&
    bridge.isLoaded
  );
}

function isBridgeSignedIn(
  bridge
) {
  return Boolean(
    isBridgeLoaded(
      bridge
    ) &&
    bridge.isSignedIn &&
    typeof bridge.getToken ===
      "function"
  );
}

function resolveBridgeEmail(
  bridge
) {
  return (
    normalizeString(
      bridge?.email
    ) ||
    normalizeString(
      readTransientCustomerProfile()
        .email
    ) ||
    null
  );
}

function resolveBridgeUserId(
  bridge
) {
  return (
    normalizeString(
      bridge?.userId
    ) ||
    normalizeString(
      bridge?.auth_subject_id
    ) ||
    normalizeString(
      readTransientCustomerProfile()
        .auth_subject_id
    ) ||
    normalizeString(
      readTransientCustomerProfile()
        .user_id
    ) ||
    null
  );
}

async function getFreshBridgeToken(
  bridge
) {
  try {
    return await bridge.getToken({
      skipCache:
        true
    });
  } catch {
    return bridge.getToken();
  }
}

function waitForAuthBridge({
  requireSignedIn = false,
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
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

      function matches(
        bridge
      ) {
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
          Date.now() -
            startedAt >
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
    }
  );
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
    await getFreshBridgeToken(
      bridge
    );

  if (!token) {
    throw new Error(
      "clerk_session_token_missing"
    );
  }

  const userId =
    resolveBridgeUserId(
      bridge
    );

  if (!userId) {
    throw new Error(
      "clerk_user_id_missing"
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
    email,

    auth_subject_id:
      userId,

    user_id:
      userId
  });

  return {
    ok:
      true,

    provider:
      "clerk",

    token,

    user_id:
      userId,

    auth_subject_id:
      userId,

    email
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
