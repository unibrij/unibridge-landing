// fiat-bank-transfer-app/src/FiatAuthIsland.jsx

import {
  useEffect
} from "react";

import {
  SignIn,
  SignedOut,
  useAuth,
  useUser
} from "@clerk/clerk-react";

const PROFILE_KEY =
  "unibridge_fiat_customer_profile";

const AUTH_BRIDGE_KEY =
  "__fiatClerkAuth";

const AUTH_EVENT =
  "fiat-clerk-auth-updated";

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

export function FiatAuthIsland() {
  const {
    isLoaded,
    isSignedIn,
    getToken
  } = useAuth();

  const {
    user
  } = useUser();

  const email =
    resolvePrimaryEmail(
      user
    );

  const returnUrl =
    resolveReturnUrl();

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

  async function testToken() {
    try {
      const token =
        await getToken();

      console.log(
        "FIAT_CLERK_TOKEN_READY",
        Boolean(token)
      );
    } catch (err) {
      console.error(
        "FIAT_CLERK_TOKEN_FAILED",
        err
      );
    }
  }

  if (!isLoaded) {
    return (
      <section className="fiat-auth-card">
        Loading secure sign-in…
      </section>
    );
  }

  if (isSignedIn) {
    return (
      <section className="fiat-auth-card fiat-auth-ok">
        <strong>Signed in securely</strong>

        {email ? (
          <p>
            {email}
          </p>
        ) : (
          <p className="fiat-auth-warning">
            Signed in, but no email was returned by Clerk.
          </p>
        )}

        <button
          type="button"
          onClick={testToken}
        >
          Test Clerk token
        </button>
      </section>
    );
  }

  return (
    <section className="fiat-auth-card">
      <h2>Secure sign-in</h2>

      <p>
        Sign in to continue bank-transfer funding.
      </p>

      <SignedOut>
        <SignIn
          routing="hash"
          forceRedirectUrl={returnUrl}
          signUpForceRedirectUrl={returnUrl}
        />
      </SignedOut>
    </section>
  );
}
