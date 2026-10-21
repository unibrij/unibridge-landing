// unibridge-landing/receive/create/receive-create-auth.js

const AUTH_BRIDGE_KEY =
  "__fiatClerkAuth";

const AUTH_EVENT =
  "fiat-clerk-auth-updated";

const PENDING_CREATE_KEY =
  "ub_receive_pending_create_v1";

const PENDING_CREATE_TTL =
  15 * 60 * 1000;


function normalizeString(value) {
  return String(value ?? "").trim();
}


export function readAuthBridge() {
  const bridge = window[AUTH_BRIDGE_KEY];

  return bridge &&
    typeof bridge === "object"
      ? bridge
      : null;
}


export function isSignedIn() {
  const bridge = readAuthBridge();

  return Boolean(
    bridge?.isLoaded &&
    bridge?.isSignedIn &&
    normalizeString(
      bridge?.auth_subject_id ||
      bridge?.userId
    )
  );
}


export function clearPendingCreate() {
  try {
    sessionStorage.removeItem(
      PENDING_CREATE_KEY
    );
  } catch {
    // Storage can be disabled.
  }
}


export function savePendingCreate(request) {
  try {
    sessionStorage.setItem(
      PENDING_CREATE_KEY,
      JSON.stringify({
        country: request.country,
        rail: request.rail,
        routeId: request.routeId,
        beneficiary: request.beneficiary,
        createdAt: Date.now()
      })
    );

    return true;
  } catch {
    return false;
  }
}


export function readPendingCreate() {
  try {
    const raw = sessionStorage.getItem(
      PENDING_CREATE_KEY
    );

    if (!raw) {
      return null;
    }

    const saved = JSON.parse(raw);

    if (
      !saved ||
      typeof saved !== "object" ||
      !saved.country ||
      !saved.rail ||
      !saved.routeId ||
      !saved.beneficiary ||
      typeof saved.beneficiary !== "object" ||
      Array.isArray(saved.beneficiary) ||
      !Number.isFinite(saved.createdAt) ||
      saved.createdAt > Date.now() ||
      Date.now() - saved.createdAt >
        PENDING_CREATE_TTL
    ) {
      clearPendingCreate();
      return null;
    }

    return saved;
  } catch {
    clearPendingCreate();
    return null;
  }
}


/*
--------------------------------------------------
Clerk authentication UI
--------------------------------------------------
*/

export function createReceiveAuthController({
  authSection,
  authBackdrop,
  authCloseButton,
  onAuthenticated,
  onCancel
} = {}) {
  let authRequested = false;
  let bound = false;


  function syncAuthUi() {
    const signedIn = isSignedIn();

    if (authSection) {
      authSection.hidden =
        signedIn || !authRequested;
    }

    return signedIn;
  }


  function revealAuth() {
    authRequested = true;
    syncAuthUi();
  }


  function hideAuth() {
    authRequested = false;
    syncAuthUi();
  }


  function closeAuth() {
    hideAuth();
    clearPendingCreate();

    onCancel?.();
  }


  function handleAuthKeydown(event) {
    if (
      event.key === "Escape" &&
      authRequested &&
      !isSignedIn()
    ) {
      closeAuth();
    }
  }


  function handleAuthUpdated() {
    const signedIn = syncAuthUi();

    if (signedIn) {
      onAuthenticated?.();
    }
  }


  function bindEvents() {
    if (bound) {
      return;
    }

    bound = true;

    authCloseButton?.addEventListener(
      "click",
      closeAuth
    );

    authBackdrop?.addEventListener(
      "click",
      closeAuth
    );

    document.addEventListener(
      "keydown",
      handleAuthKeydown
    );

    window.addEventListener(
      AUTH_EVENT,
      handleAuthUpdated
    );
  }


  return {
    isSignedIn,
    syncAuthUi,
    revealAuth,
    hideAuth,
    bindEvents
  };
}
