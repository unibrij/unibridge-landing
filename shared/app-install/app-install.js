
// shared/app-install/app-install.js

import {
  PLAY_STORE_URL,
  PLAY_BANNER_ICON_URL,
  shouldShowPlayBanner,
  markPlayBannerSeen,
  dismissPlayBanner,
  emitPlayBannerEvent
} from "./app-install-policy.js";

const BANNER_ID = "ubPlayBanner";

const WAIT_TIMEOUT_MS = 10000;

let mounted = false;

/* -----------------------------------------
   Build banner
----------------------------------------- */

function buildBanner(siteVariant = false) {
  const banner = document.createElement("aside");

  banner.id = BANNER_ID;

  banner.className =
    "ub-play-banner" +
    (siteVariant ? " ub-play-banner--site" : "");

  banner.setAttribute(
    "aria-label",
    "Get UniBridge on Google Play"
  );

  /* App icon */

  const icon = document.createElement("img");

  icon.className = "ub-play-banner__icon";
  icon.src = PLAY_BANNER_ICON_URL;
  icon.alt = "";
  icon.width = 36;
  icon.height = 36;

  /* Text */

  const copy = document.createElement("div");

  copy.className = "ub-play-banner__copy";

  const title = document.createElement("strong");

  title.className = "ub-play-banner__title";
  title.textContent = "UniBridge on Google Play";

  const description = document.createElement("span");

  description.className =
    "ub-play-banner__description";

  description.textContent =
    "Get the app, or continue on the web.";

  copy.append(title, description);

  /* Google Play link */

  const link = document.createElement("a");

  link.className = "ub-play-banner__link";
  link.href = PLAY_STORE_URL;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Get App";

  link.addEventListener("click", () => {
    emitPlayBannerEvent("click");
  });

  /* Dismiss button */

  const dismiss = document.createElement("button");

  dismiss.className = "ub-play-banner__dismiss";
  dismiss.type = "button";
  dismiss.textContent = "×";

  dismiss.setAttribute(
    "aria-label",
    "Dismiss app suggestion"
  );

  dismiss.addEventListener("click", () => {
    dismissPlayBanner();

    banner.remove();

    emitPlayBannerEvent("dismiss");
  });

  banner.append(
    icon,
    copy,
    link,
    dismiss
  );

  return banner;
}

/* -----------------------------------------
   Resolve insertion anchor
----------------------------------------- */

function resolveAnchor() {
  const payBrand =
    document.getElementById("pay-brand");

  if (
    payBrand &&
    payBrand.querySelector(".pay-brandbar")
  ) {
    return {
      element: payBrand,
      siteVariant: false
    };
  }

  const siteHeader =
    document.getElementById("site-header");

  if (
    siteHeader &&
    siteHeader.querySelector("header")
  ) {
    return {
      element: siteHeader,
      siteVariant: true
    };
  }

  return null;
}

/* -----------------------------------------
   Mount once
----------------------------------------- */

function mountBanner() {
  if (mounted) {
    return true;
  }

  if (document.getElementById(BANNER_ID)) {
    mounted = true;
    return true;
  }

  if (!shouldShowPlayBanner()) {
    return false;
  }

  const anchor = resolveAnchor();

  if (!anchor || !anchor.element.parentElement) {
    return false;
  }

  const banner = buildBanner(
    anchor.siteVariant
  );

  anchor.element.insertAdjacentElement(
    "afterend",
    banner
  );

  mounted = true;

  markPlayBannerSeen();

  emitPlayBannerEvent("view");

  return true;
}

/* -----------------------------------------
   Initialize after partials
----------------------------------------- */

function initialize() {
  if (!shouldShowPlayBanner()) {
    return;
  }

  if (mountBanner()) {
    return;
  }

  let observer = null;
  let timeoutId = null;

  function cleanup() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }

    document.removeEventListener(
      "pay-partials-ready",
      onPartialsReady
    );

    document.removeEventListener(
      "site-partials-ready",
      onPartialsReady
    );

    window.removeEventListener(
      "pagehide",
      cleanup
    );
  }

  function onPartialsReady() {
    if (mountBanner()) {
      cleanup();
    }
  }

  document.addEventListener(
    "pay-partials-ready",
    onPartialsReady
  );

  document.addEventListener(
    "site-partials-ready",
    onPartialsReady
  );

  /* Temporary observer for asynchronous partials */

  observer = new MutationObserver(
    onPartialsReady
  );

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  timeoutId = window.setTimeout(
    cleanup,
    WAIT_TIMEOUT_MS
  );

  window.addEventListener(
    "pagehide",
    cleanup
  );

  /* Handle partials loaded during initialization */

  onPartialsReady();
}

/* -----------------------------------------
   Bootstrap
----------------------------------------- */

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initialize,
    { once: true }
  );
} else {
  initialize();
}
