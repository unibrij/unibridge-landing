// fiat-bank-transfer-app/src/FiatAuthIsland.jsx

import {
  useEffect
} from "react";

import {
  SignIn,
  SignedOut,
  useAuth,
  useClerk,
  useUser
} from "@clerk/clerk-react";

const PROFILE_KEY =
  "unibridge_fiat_customer_profile";

const AUTH_BRIDGE_KEY =
  "__fiatClerkAuth";

const AUTH_EVENT =
  "fiat-clerk-auth-updated";

const AUTH_REQUIRED_CLASS =
  "fiat-auth-required";

function normalizeString(value) {
  return String(value || "").trim();
}

function readStoredProfile() {
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

function writeEmailToProfile(email) {
  const normalizedEmail =
    normalizeString(email);

  if (!normalizedEmail) {
    return;
  }

  const existing =
    readStoredProfile();

  window.sessionStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({
      ...existing,

      email:
        normalizedEmail
    })
  );
}

function clearStoredProfile() {
  window.sessionStorage.removeItem(
    PROFILE_KEY
  );
}

function resolvePrimaryEmail(user) {
  return (
    normalizeString(
      user?.primaryEmailAddress?.emailAddress
    ) ||
    normalizeString(
      user?.emailAddresses?.[0]?.emailAddress
    ) ||
    null
  );
}

function resolveReturnUrl() {
  return (
    window.location.origin +
    window.location.pathname +
    window.location.search
  );
}

function setAuthRequiredClass(required) {
  document.body.classList.toggle(
    AUTH_REQUIRED_CLASS,
    Boolean(required)
  );
}

export function FiatAuthIsland() {
  const {
    isLoaded,
    isSignedIn,
    getToken
  } = useAuth();

  const {
    signOut
  } = useClerk();

  const {
    user
  } = useUser();

  const email =
    resolvePrimaryEmail(
      user
    );

  const returnUrl =
    resolveReturnUrl();

  const isReady =
    Boolean(
      isLoaded &&
      isSignedIn &&
      email
    );

  useEffect(() => {
    window[AUTH_BRIDGE_KEY] = {
      isLoaded,
      isSignedIn,

      email:
        email || null,

      getToken
    };

    window.dispatchEvent(
      new CustomEvent(
        AUTH_EVENT,
        {
          detail: {
            isLoaded,
            isSignedIn,

            email:
              email || null
          }
        }
      )
    );
  }, [
    isLoaded,
    isSignedIn,
    email,
    getToken
  ]);

  useEffect(() => {
    setAuthRequiredClass(
      !isReady
    );

    return () => {
      setAuthRequiredClass(
        false
      );
    };
  }, [
    isReady
  ]);

  useEffect(() => {
    if (
      !isLoaded ||
      !isSignedIn ||
      !email
    ) {
      return;
    }

    writeEmailToProfile(
      email
    );
  }, [
    isLoaded,
    isSignedIn,
    email
  ]);

  async function useAnotherAccount() {
    clearStoredProfile();

    await signOut({
      redirectUrl:
        returnUrl
    });
  }

  if (isReady) {
    return (
      <section className="fiat-auth-session-bar">
        <div>
          <span>
            Signed in as
          </span>

          <strong>
            {email}
          </strong>
        </div>

        <button
          type="button"
          onClick={useAnotherAccount}
        >
          Use another account
        </button>
      </section>
    );
  }

  if (isLoaded && isSignedIn && !email) {
    return (
      <section className="fiat-auth-gate">
        <p className="fiat-auth-warning">
          Signed in, but no email was returned by Clerk.
        </p>
      </section>
    );
  }

  if (!isLoaded) {
    return (
      <section className="fiat-auth-gate">
        <p className="fiat-auth-loading">
          Loading secure access…
        </p>
      </section>
    );
  }

  return (
    <section className="fiat-auth-gate">
      <div className="fiat-auth-clerk-panel">
        <SignedOut>
          <SignIn
            routing="hash"
            forceRedirectUrl={returnUrl}
            signUpForceRedirectUrl={returnUrl}
          />
        </SignedOut>
      </div>
    </section>
  );
}
