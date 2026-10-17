
// shared/app-install/app-install-policy.js

const PACKAGE_ID = "io.unibrij.app";

export const PLAY_STORE_URL =
  `https://play.google.com/store/apps/details?id=${PACKAGE_ID}`;

export const PLAY_BANNER_ICON_URL =
  "/connect/icons/app/ub-app-icon-192.png";

const DISMISS_KEY =
  "ub_play_banner_dismissed_until_v1";

const SEEN_KEY =
  "ub_play_banner_seen_session_v1";

const DISMISS_DURATION_MS =
  14 * 24 * 60 * 60 * 1000;

const ENTRY_PATHS = new Set([
  "/",
  "/about",
  "/pay",
  "/receive",
  "/surface",
  "/connect"
]);

/* -----------------------------------------
   Safe storage
----------------------------------------- */

function readStorage(type, key) {
  try {
    return window[type].getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(type, key, value) {
  try {
    window[type].setItem(key, value);
  } catch {
    // Storage may be unavailable.
  }
}

/* -----------------------------------------
   Path normalization
----------------------------------------- */

function normalizePath(pathname) {
  return (
    String(pathname || "/")
      .replace(/\/+$/, "") || "/"
  );
}

/* -----------------------------------------
   Device and application context
----------------------------------------- */

function isAndroid() {
  return /Android/i.test(
    navigator.userAgent || ""
  );
}

function isStandalone() {
  try {
    if (
      window.matchMedia?.(
        "(display-mode: standalone)"
      ).matches ||
      window.matchMedia?.(
        "(display-mode: fullscreen)"
      ).matches
    ) {
      return true;
    }
  } catch {
    // Display-mode detection unavailable.
  }

  if (navigator.standalone === true) {
    return true;
  }

  /* Only recognize UniBridge's own Android app. */
  try {
    const referrer = new URL(
      document.referrer || ""
    );

    if (
      referrer.protocol === "android-app:" &&
      referrer.hostname === PACKAGE_ID
    ) {
      return true;
    }
  } catch {
    // No identifiable Android app referrer.
  }

  return false;
}

/* -----------------------------------------
   Active transaction protection
----------------------------------------- */

function hasActiveTransaction(search) {
  const params = new URLSearchParams(
    search || ""
  );

  return (
    params.has("payout_intent_id") ||
    params.has("settlement_id")
  );
}

/* -----------------------------------------
   Shared eligibility policy
----------------------------------------- */

export function shouldShowPlayBanner({
  hidden = false,
  pathname,
  search
} = {}) {
  if (
    typeof window === "undefined" ||
    typeof navigator === "undefined"
  ) {
    return false;
  }

  if (hidden) return false;

  if (!isAndroid()) return false;

  if (isStandalone()) return false;

  const currentPath = normalizePath(
    pathname ?? window.location.pathname
  );

  if (!ENTRY_PATHS.has(currentPath)) {
    return false;
  }

  if (
    hasActiveTransaction(
      search ?? window.location.search
    )
  ) {
    return false;
  }

  if (
    readStorage("sessionStorage", SEEN_KEY) === "1"
  ) {
    return false;
  }

  const dismissedUntil = Number(
    readStorage("localStorage", DISMISS_KEY)
  );

  if (
    Number.isFinite(dismissedUntil) &&
    dismissedUntil > Date.now()
  ) {
    return false;
  }

  return true;
}

/* -----------------------------------------
   Mark banner as displayed
----------------------------------------- */

export function markPlayBannerSeen() {
  writeStorage(
    "sessionStorage",
    SEEN_KEY,
    "1"
  );
}

/* -----------------------------------------
   Dismiss for 14 days
----------------------------------------- */

export function dismissPlayBanner() {
  const expiresAt =
    Date.now() + DISMISS_DURATION_MS;

  writeStorage(
    "localStorage",
    DISMISS_KEY,
    String(expiresAt)
  );

  markPlayBannerSeen();
}

/* -----------------------------------------
   Shared event hook
----------------------------------------- */

export function emitPlayBannerEvent(eventName) {
  if (
    !["view", "click", "dismiss"].includes(
      eventName
    )
  ) {
    return;
  }

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.dispatchEvent(
      new CustomEvent(
        "unibridge:play-banner",
        {
          detail: {
            event: eventName,
            page: window.location.pathname
          }
        }
      )
    );
  } catch {
    // Analytics must never block the UI.
  }
}
