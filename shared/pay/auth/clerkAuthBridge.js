// shared/pay/auth/clerkAuthBridge.js

const PROFILE_KEY =
  "unibridge_fiat_customer_profile";

const AUTH_BRIDGE_KEY =
  "__fiatClerkAuth";

const AUTH_EVENT =
  "fiat-clerk-auth-updated";


function normalizeString(value) {
  return String(value || "").trim();
}


export function readStoredAuthProfile() {
  const raw =
    window.sessionStorage.getItem(
      PROFILE_KEY
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


export function writeAuthProfile({
  email,
  userId
} = {}) {
  const normalizedEmail =
    normalizeString(email);

  const normalizedUserId =
    normalizeString(userId);

  if (
    !normalizedEmail &&
    !normalizedUserId
  ) {
    return readStoredAuthProfile();
  }

  const existing =
    readStoredAuthProfile();

  const next = {
    ...existing,

    ...(normalizedEmail
      ? {
          email:
            normalizedEmail
        }
      : {}),

    ...(normalizedUserId
      ? {
          auth_provider:
            "clerk",

          auth_subject_id:
            normalizedUserId,

          user_id:
            normalizedUserId
        }
      : {})
  };

  window.sessionStorage.setItem(
    PROFILE_KEY,
    JSON.stringify(next)
  );

  return next;
}


export function clearAuthProfile() {
  window.sessionStorage.removeItem(
    PROFILE_KEY
  );
}


export function resolvePrimaryEmail(user) {
  return (
    normalizeString(
      user?.primaryEmailAddress
        ?.emailAddress
    ) ||
    normalizeString(
      user?.emailAddresses?.[0]
        ?.emailAddress
    ) ||
    null
  );
}


export function resolveAuthSubjectId({
  userId,
  user
} = {}) {
  return (
    normalizeString(
      userId
    ) ||
    normalizeString(
      user?.id
    ) ||
    null
  );
}


export function publishClerkAuthBridge({
  isLoaded,
  isSignedIn,
  userId,
  email,
  getToken
} = {}) {
  const authSubjectId =
    normalizeString(userId) ||
    null;

  const normalizedEmail =
    normalizeString(email) ||
    null;

  const bridge = {
    isLoaded:
      Boolean(isLoaded),

    isSignedIn:
      Boolean(isSignedIn),

    userId:
      authSubjectId,

    auth_subject_id:
      authSubjectId,

    email:
      normalizedEmail,

    getToken
  };

  window[AUTH_BRIDGE_KEY] =
    bridge;

  window.dispatchEvent(
    new CustomEvent(
      AUTH_EVENT,
      {
        detail: {
          isLoaded:
            bridge.isLoaded,

          isSignedIn:
            bridge.isSignedIn,

          userId:
            authSubjectId,

          auth_subject_id:
            authSubjectId,

          email:
            normalizedEmail
        }
      }
    )
  );

  return bridge;
}


export function readClerkAuthBridge() {
  return (
    window[AUTH_BRIDGE_KEY] ||
    null
  );
}


export {
  PROFILE_KEY,
  AUTH_BRIDGE_KEY,
  AUTH_EVENT
};
