// fiat/bank-transfer/js/clerkAuth.js

const CLERK_PUBLISHABLE_KEY =
  "pk_test_bW92aW5nLWtpZC04Ny5jbGVyay5hY2NvdW50cy5kZXYk";

const FIAT_CUSTOMER_PROFILE_KEY =
  "unibridge_fiat_customer_profile";

let clerkJsLoadingPromise = null;
let clerkUiLoadingPromise = null;
let clerkLoadPromise = null;
let signInWaitPromise = null;
let clerkInstance = null;

function normalizeString(value) {
  return String(value || "").trim();
}

function getEl(id) {
  return document.getElementById(id);
}

function show(el) {
  el?.classList.remove("hidden");
}

function hide(el) {
  el?.classList.add("hidden");
}

function setAuthStatus(message) {
  const box =
    getEl("fiatAuthBox");

  if (!box) {
    return;
  }

  box.textContent =
    message;

  show(box);
}

function clearAuthStatus() {
  const box =
    getEl("fiatAuthBox");

  if (!box) {
    return;
  }

  hide(box);
}

function getClerkMount() {
  return getEl("clerkMount");
}

function getClerkGlobal() {
  return window.Clerk || null;
}

function resolveClerkDomain() {
  const encoded =
    normalizeString(
      CLERK_PUBLISHABLE_KEY.split("_")[2]
    );

  if (!encoded) {
    throw new Error("clerk_publishable_key_invalid");
  }

  return atob(encoded).slice(0, -1);
}

function loadScript({
  src,
  existingGlobal,
  errorCode
}) {
  if (
    typeof existingGlobal === "function" &&
    existingGlobal()
  ) {
    return Promise.resolve(
      existingGlobal()
    );
  }

  const existing =
    document.querySelector(
      `script[src="${src}"]`
    );

  if (existing) {
    return new Promise((resolve, reject) => {
      const resolveWhenReady =
        () => {
          const value =
            typeof existingGlobal === "function"
              ? existingGlobal()
              : true;

          if (value) {
            resolve(value);
            return true;
          }

          return false;
        };

      if (resolveWhenReady()) {
        return;
      }

      existing.addEventListener(
        "load",
        () => {
          if (!resolveWhenReady()) {
            reject(
              new Error(errorCode)
            );
          }
        },
        { once: true }
      );

      existing.addEventListener(
        "error",
        () => {
          reject(
            new Error(errorCode)
          );
        },
        { once: true }
      );

      window.setTimeout(
        () => {
          if (!resolveWhenReady()) {
            reject(
              new Error(errorCode)
            );
          }
        },
        3000
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script =
      document.createElement("script");

    script.src =
      src;

    script.async =
      true;

    script.crossOrigin =
      "anonymous";

    script.onload =
      () => {
        const value =
          typeof existingGlobal === "function"
            ? existingGlobal()
            : true;

        if (value) {
          resolve(value);
          return;
        }

        reject(
          new Error(errorCode)
        );
      };

    script.onerror =
      () => {
        reject(
          new Error(errorCode)
        );
      };

    document.head.appendChild(
      script
    );
  });
}

function loadClerkJs() {
  if (getClerkGlobal()) {
    return Promise.resolve(
      getClerkGlobal()
    );
  }

  if (clerkJsLoadingPromise) {
    return clerkJsLoadingPromise;
  }

  const domain =
    resolveClerkDomain();

  const src =
    `https://${domain}/npm/@clerk/clerk-js@latest/dist/clerk.browser.js`;

  clerkJsLoadingPromise =
    loadScript({
      src,
      existingGlobal:
        getClerkGlobal,
      errorCode:
        "clerk_js_load_failed"
    }).catch((err) => {
      clerkJsLoadingPromise =
        null;

      throw err;
    });

  return clerkJsLoadingPromise;
}

function loadClerkUi() {
  if (window.__internal_ClerkUICtor) {
    return Promise.resolve(
      window.__internal_ClerkUICtor
    );
  }

  if (clerkUiLoadingPromise) {
    return clerkUiLoadingPromise;
  }

  const domain =
    resolveClerkDomain();

  const src =
    `https://${domain}/npm/@clerk/ui@1/dist/ui.browser.js`;

  clerkUiLoadingPromise =
    loadScript({
      src,
      existingGlobal:
        () => {
          return window.__internal_ClerkUICtor || null;
        },
      errorCode:
        "clerk_ui_load_failed"
    }).catch((err) => {
      clerkUiLoadingPromise =
        null;

      throw err;
    });

  return clerkUiLoadingPromise;
}

export async function loadClerk() {
  if (clerkLoadPromise) {
    return clerkLoadPromise;
  }

  clerkLoadPromise =
    (async () => {
      const ClerkGlobal =
        await loadClerkJs();

      const ClerkUI =
        await loadClerkUi();

      if (!clerkInstance) {
        clerkInstance =
          typeof ClerkGlobal === "function"
            ? new ClerkGlobal(
                CLERK_PUBLISHABLE_KEY
              )
            : ClerkGlobal;
      }

      if (
        !clerkInstance ||
        typeof clerkInstance.load !== "function"
      ) {
        throw new Error("clerk_instance_invalid");
      }

      await clerkInstance.load({
        ui: {
          ClerkUI
        }
      });

      return clerkInstance;
    })().catch((err) => {
      clerkLoadPromise =
        null;

      throw err;
    });

  return clerkLoadPromise;
}

function resolvePrimaryEmail(user = {}) {
  return (
    normalizeString(
      user.primaryEmailAddress?.emailAddress
    ) ||
    normalizeString(
      user.emailAddresses?.[0]?.emailAddress
    ) ||
    null
  );
}

function writeTransientCustomerProfile({
  email
} = {}) {
  const normalizedEmail =
    normalizeString(email);

  if (!normalizedEmail) {
    return;
  }

  const existingRaw =
    window.sessionStorage.getItem(
      FIAT_CUSTOMER_PROFILE_KEY
    );

  let existing = {};

  if (existingRaw) {
    try {
      existing =
        JSON.parse(existingRaw) || {};
    } catch {
      existing = {};
    }
  }

  window.sessionStorage.setItem(
    FIAT_CUSTOMER_PROFILE_KEY,
    JSON.stringify({
      ...existing,

      email:
        normalizedEmail
    })
  );
}

export function readTransientCustomerProfile() {
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

export function clearTransientCustomerProfile() {
  window.sessionStorage.removeItem(
    FIAT_CUSTOMER_PROFILE_KEY
  );
}

async function getSessionToken(clerk) {
  const session =
    clerk.session ||
    clerk.client?.sessions?.find((item) => {
      return item?.status === "active";
    }) ||
    null;

  if (
    !session ||
    typeof session.getToken !== "function"
  ) {
    throw new Error("clerk_session_missing");
  }

  const token =
    await session.getToken();

  if (!token) {
    throw new Error("clerk_session_token_missing");
  }

  return token;
}

async function resolveSignedInAuth(clerk) {
  const token =
    await getSessionToken(
      clerk
    );

  const user =
    clerk.user || null;

  const email =
    resolvePrimaryEmail(
      user
    );

  writeTransientCustomerProfile({
    email
  });

  clearAuthStatus();

  hide(
    getClerkMount()
  );

  return {
    ok:
      true,

    provider:
      "clerk",

    token,

    user_id:
      normalizeString(user?.id) || null,

    email:
      email || null,

    email_verified:
      Boolean(email)
  };
}

function waitForSignIn(clerk) {
  if (signInWaitPromise) {
    return signInWaitPromise;
  }

  signInWaitPromise =
    new Promise((resolve, reject) => {
      let unsubscribe = null;

      const timeout =
        window.setTimeout(
          () => {
            if (typeof unsubscribe === "function") {
              unsubscribe();
            }

            signInWaitPromise =
              null;

            reject(
              new Error("clerk_sign_in_timeout")
            );
          },
          5 * 60 * 1000
        );

      unsubscribe =
        clerk.addListener(async ({ user }) => {
          if (!user) {
            return;
          }

          try {
            window.clearTimeout(
              timeout
            );

            if (typeof unsubscribe === "function") {
              unsubscribe();
            }

            signInWaitPromise =
              null;

            resolve(
              await resolveSignedInAuth(
                clerk
              )
            );
          } catch (err) {
            signInWaitPromise =
              null;

            reject(err);
          }
        });
    });

  return signInWaitPromise;
}

export async function ensureFiatClerkAuth() {
  setAuthStatus(
    "Please sign in securely to continue bank-transfer funding."
  );

  const clerk =
    await loadClerk();

  if (clerk.isSignedIn) {
    return resolveSignedInAuth(
      clerk
    );
  }

  const mount =
    getClerkMount();

  if (!mount) {
    throw new Error("clerk_mount_missing");
  }

  mount.innerHTML =
    "";

  show(
    mount
  );

  if (typeof clerk.mountSignIn !== "function") {
    throw new Error("clerk_mount_sign_in_missing");
  }

  clerk.mountSignIn(
    mount,
    {
      routing:
        "hash",

      signUpForceRedirectUrl:
        window.location.href,

      signInForceRedirectUrl:
        window.location.href
    }
  );

  return waitForSignIn(
    clerk
  );
}

export async function getFiatClerkToken() {
  const clerk =
    await loadClerk();

  if (!clerk.isSignedIn) {
    throw new Error("clerk_not_signed_in");
  }

  return getSessionToken(
    clerk
  );
}

export async function buildClerkAuthorizationHeader() {
  const token =
    await getFiatClerkToken();

  return {
    Authorization:
      `Bearer ${token}`
  };
}
