// fiat-bank-transfer-app/src/FiatAuthIsland.jsx

import {
  useEffect,
  useState
} from "react";

import {
  SignIn,
  SignedOut,
  useAuth,
  useClerk,
  useUser
} from "@clerk/clerk-react";

import {
  AccountSettings
} from "./AccountSettings.jsx";


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


function writeAuthToProfile({
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
    return;
  }

  const existing =
    readStoredProfile();

  window.sessionStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({
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
    })
  );
}


function clearFiatAuthSession() {
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


function resolveAuthSubjectId({
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


function resolveReturnUrl() {
  return (
    window.location.origin +
    window.location.pathname +
    window.location.search
  );
}


function resolvePayUrl() {
  return `${window.location.origin}/pay`;
}


function setAuthRequiredClass(required) {
  document.body.classList.toggle(
    AUTH_REQUIRED_CLASS,
    Boolean(required)
  );
}


function SettingsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />

      <path
        d="
          M19.1 13.5
          a7.8 7.8 0 0 0 .05-1
          7.8 7.8 0 0 0-.05-1
          l2-1.55
          -2-3.46
          -2.45.98
          a7.7 7.7 0 0 0-1.72-1
          L14.55 4
          h-4
          l-.38 2.47
          a7.7 7.7 0 0 0-1.72 1
          L6 6.49
          4 9.95
          6 11.5
          a7.8 7.8 0 0 0-.05 1
          7.8 7.8 0 0 0 .05 1
          L4 15.05
          l2 3.46
          2.45-.98
          a7.7 7.7 0 0 0 1.72 1
          l.38 2.47
          h4
          l.38-2.47
          a7.7 7.7 0 0 0 1.72-1
          l2.45.98
          2-3.46
          -2-1.55Z
        "
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}


export function FiatAuthIsland() {
  const {
    isLoaded,
    isSignedIn,
    userId,
    getToken
  } = useAuth();

  const {
    signOut
  } = useClerk();

  const {
    user
  } = useUser();

  const [
    settingsOpen,
    setSettingsOpen
  ] = useState(false);

  const email =
    resolvePrimaryEmail(
      user
    );

  const authSubjectId =
    resolveAuthSubjectId({
      userId,
      user
    });

  const returnUrl =
    resolveReturnUrl();

  const isReady =
    Boolean(
      isLoaded &&
      isSignedIn &&
      email &&
      authSubjectId
    );


  useEffect(() => {
    window[AUTH_BRIDGE_KEY] = {
      isLoaded,
      isSignedIn,

      userId:
        authSubjectId,

      auth_subject_id:
        authSubjectId,

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

            userId:
              authSubjectId,

            auth_subject_id:
              authSubjectId,

            email:
              email || null
          }
        }
      )
    );
  }, [
    isLoaded,
    isSignedIn,
    authSubjectId,
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
      !email ||
      !authSubjectId
    ) {
      return;
    }

    writeAuthToProfile({
      email,

      userId:
        authSubjectId
    });
  }, [
    isLoaded,
    isSignedIn,
    email,
    authSubjectId
  ]);


  function openSettings() {
    setSettingsOpen(
      true
    );
  }


  function closeSettings() {
    setSettingsOpen(
      false
    );
  }


  async function useAnotherAccount() {
    setSettingsOpen(
      false
    );

    clearFiatAuthSession();

    const payUrl =
      resolvePayUrl();

    try {
      await signOut({
        redirectUrl:
          payUrl
      });
    } finally {
      window.location.replace(
        payUrl
      );
    }
  }


  if (isReady) {
    return (
      <>
        <section className="fiat-auth-session-bar">
          <div className="fiat-auth-session-identity">
            <span>
              Signed in as
            </span>

            <strong>
              {email}
            </strong>
          </div>

          <div className="fiat-auth-session-actions">
            <button
              type="button"
              onClick={useAnotherAccount}
            >
              Use another account
            </button>

            <button
              type="button"
              className="fiat-auth-settings-button"
              onClick={openSettings}
              aria-label="Account settings"
              aria-expanded={
                settingsOpen
                  ? "true"
                  : "false"
              }
              title="Account settings"
            >
              <SettingsIcon />
            </button>
          </div>
        </section>

        <AccountSettings
          open={settingsOpen}
          email={email}
          authSubjectId={authSubjectId}
          getToken={getToken}
          onClose={closeSettings}
          onSwitchAccount={useAnotherAccount}
        />
      </>
    );
  }


  if (
    isLoaded &&
    isSignedIn &&
    !email
  ) {
    return (
      <section className="fiat-auth-gate">
        <p className="fiat-auth-warning">
          Signed in, but no email was returned by Clerk.
        </p>
      </section>
    );
  }


  if (
    isLoaded &&
    isSignedIn &&
    !authSubjectId
  ) {
    return (
      <section className="fiat-auth-gate">
        <p className="fiat-auth-warning">
          Signed in, but no user ID was returned by Clerk.
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
            oauthFlow="popup"
            forceRedirectUrl={returnUrl}
            signUpForceRedirectUrl={returnUrl}
            appearance={{
              elements: {
                headerTitle: {
                  display:
                    "none"
                }
              }
            }}
          />
        </SignedOut>
      </div>
    </section>
  );
}
