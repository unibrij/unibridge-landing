
import {
  useEffect,
  useState
} from "react";

import "./account-settings.css";


function normalizeString(value) {
  return String(
    value || ""
  ).trim();
}


function normalizeVerificationStatus(
  value
) {
  const status =
    normalizeString(
      value
    ).toLowerCase();

  if (
    status === "passed" ||
    status === "verified" ||
    status === "approved"
  ) {
    return "verified";
  }

  if (
    status === "pending" ||
    status === "in_review" ||
    status === "in review"
  ) {
    return "pending";
  }

  if (
    status === "failed" ||
    status === "declined"
  ) {
    return "failed";
  }

  if (
    status === "not_started" ||
    status === "not started" ||
    status === "unverified"
  ) {
    return "not_verified";
  }

  return "unknown";
}


function getVerificationLabel(
  status
) {
  switch (
    normalizeVerificationStatus(
      status
    )
  ) {
    case "verified":
      return "Verified";

    case "pending":
      return "Pending";

    case "failed":
      return "Verification failed";

    case "not_verified":
      return "Not verified";

    default:
      return "Unavailable";
  }
}


function getVerificationClassName(
  status
) {
  const normalized =
    normalizeVerificationStatus(
      status
    );

  return [
    "account-settings-status",
    `account-settings-status-${normalized}`
  ].join(" ");
}


function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M6 6l12 12M18 6 6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}


function AccountIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="12"
        cy="8"
        r="3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />

      <path
        d="M5.5 19c.8-3.2 3-5 6.5-5s5.7 1.8 6.5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}


function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="3.5"
        y="5.5"
        width="17"
        height="13"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />

      <path
        d="m5 7 7 5 7-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}


function LogoutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M10 5H6.5A2.5 2.5 0 0 0 4 7.5v9A2.5 2.5 0 0 0 6.5 19H10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />

      <path
        d="M14 8l4 4-4 4M18 12H9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}


function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4.5 7h15M9 7V4.5h6V7M7 7l.8 12h8.4L17 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}


async function resolveBearerToken(
  getToken
) {
  if (
    typeof getToken !==
    "function"
  ) {
    throw new Error(
      "account_auth_unavailable"
    );
  }

  let token = null;

  try {
    token =
      await getToken({
        skipCache: true
      });
  } catch {
    token =
      await getToken();
  }

  const normalized =
    normalizeString(
      token
    );

  if (!normalized) {
    throw new Error(
      "account_auth_token_missing"
    );
  }

  return normalized;
}


async function parseResponse(
  response
) {
  const text =
    await response.text();

  let data = {};

  if (text) {
    try {
      data =
        JSON.parse(
          text
        );
    } catch {
      data = {
        raw: text
      };
    }
  }

  if (!response.ok) {
    const message =
      normalizeString(
        data?.error?.message
      ) ||
      normalizeString(
        typeof data?.error === "string"
          ? data.error
          : ""
      ) ||
      normalizeString(
        data?.message
      ) ||
      "account_request_failed";

    throw new Error(
      message
    );
  }

  return data;
}


async function accountRequest({
  method,
  getToken
} = {}) {
  const token =
    await resolveBearerToken(
      getToken
    );

  const response =
    await fetch(
      "/api/proxy?endpoint=account",
      {
        method,

        headers: {
          authorization:
            `Bearer ${token}`
        }
      }
    );

  return parseResponse(
    response
  );
}


export function AccountSettings({
  open = false,
  email,
  getToken,
  onClose,
  onSwitchAccount
} = {}) {
  const [
    account,
    setAccount
  ] = useState(null);

  const [
    loading,
    setLoading
  ] = useState(false);

  const [
    loadFailed,
    setLoadFailed
  ] = useState(false);

  const [
    confirmDelete,
    setConfirmDelete
  ] = useState(false);

  const [
    deleting,
    setDeleting
  ] = useState(false);

  const [
    deleteError,
    setDeleteError
  ] = useState("");

  const [
    deleteSucceeded,
    setDeleteSucceeded
  ] = useState(false);


  useEffect(() => {
    if (!open) {
      setConfirmDelete(false);
      setDeleteError("");
      return;
    }

    let active = true;

    async function loadAccount() {
      setLoading(true);
      setLoadFailed(false);

      try {
        const result =
          await accountRequest({
            method: "GET",
            getToken
          });

        if (!active) {
          return;
        }

        setAccount(
          result?.account ||
          result ||
          null
        );
      } catch {
        if (!active) {
          return;
        }

        setAccount(null);
        setLoadFailed(true);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadAccount();

    return () => {
      active = false;
    };
  }, [
    open,
    getToken
  ]);


  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleKeyDown(
      event
    ) {
      if (
        event.key !== "Escape" ||
        deleting
      ) {
        return;
      }

      if (confirmDelete) {
        setConfirmDelete(false);
        return;
      }

      onClose?.();
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    open,
    confirmDelete,
    deleting,
    onClose
  ]);


  async function handleDeleteAccount() {
    if (
      deleting ||
      deleteSucceeded
    ) {
      return;
    }

    setDeleting(true);
    setDeleteError("");

    try {
      await accountRequest({
        method: "DELETE",
        getToken
      });
    } catch (error) {
      setDeleteError(
        normalizeString(
          error?.message
        ) ||
        "Unable to delete account."
      );

      setDeleting(false);
      return;
    }

    setDeleteSucceeded(true);

    try {
      if (
        typeof onSwitchAccount ===
        "function"
      ) {
        await onSwitchAccount();
      }
    } catch {
      // Deletion succeeded; account switching failed.
    }

    window.location.replace(
      "/surface/"
    );
  }


  if (!open) {
    return null;
  }


  const accountEmail =
    normalizeString(
      account?.email
    ) ||
    normalizeString(
      email
    );

  const verificationStatus =
    account?.verification_status ??
    account?.kyc_status ??
    null;

  const verificationLabel =
    loading
      ? "Loading…"
      : loadFailed
        ? "Unavailable"
        : getVerificationLabel(
            verificationStatus
          );


  return (
    <div
      className="account-settings-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
            event.currentTarget &&
          !deleting
        ) {
          onClose?.();
        }
      }}
    >
      <section
        className="account-settings-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="accountSettingsTitle"
      >
        <header className="account-settings-header">
          <div>
            <span className="account-settings-eyebrow">
              UniBridge
            </span>

            <h2 id="accountSettingsTitle">
              Settings
            </h2>
          </div>

          <button
            type="button"
            className="account-settings-close"
            disabled={deleting}
            onClick={() => {
              if (!deleting) {
                onClose?.();
              }
            }}
            aria-label="Close settings"
          >
            <CloseIcon />
          </button>
        </header>


        {!confirmDelete ? (
          <div className="account-settings-content">
            <section className="account-settings-section">
              <h3>
                Profile
              </h3>

              <div className="account-settings-card">
                <div className="account-settings-row">
                  <div className="account-settings-row-icon">
                    <AccountIcon />
                  </div>

                  <div className="account-settings-row-copy">
                    <span>
                      Verification status
                    </span>

                    <strong
                      className={
                        getVerificationClassName(
                          verificationStatus
                        )
                      }
                    >
                      {verificationLabel}
                    </strong>
                  </div>
                </div>
              </div>
            </section>


            <section className="account-settings-section">
              <h3>
                Account
              </h3>

              <div className="account-settings-card">
                <div className="account-settings-row">
                  <div className="account-settings-row-icon">
                    <MailIcon />
                  </div>

                  <div className="account-settings-row-copy">
                    <span>
                      Email
                    </span>

                    <strong>
                      {accountEmail || "Unavailable"}
                    </strong>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="account-settings-action"
                disabled={deleting}
                onClick={() => {
                  onSwitchAccount?.();
                }}
              >
                <LogoutIcon />

                <span>
                  Use another account
                </span>
              </button>
            </section>


            <section
              className="
                account-settings-section
                account-settings-danger-section
              "
            >
              <h3>
                Danger zone
              </h3>

              <button
                type="button"
                className="account-settings-delete-action"
                disabled={deleting}
                onClick={() => {
                  setDeleteError("");
                  setConfirmDelete(true);
                }}
              >
                <TrashIcon />

                <span>
                  Delete account
                </span>
              </button>
            </section>
          </div>
        ) : (
          <div className="account-settings-delete-confirmation">
            <div className="account-settings-delete-icon">
              <TrashIcon />
            </div>

            <h3>
              Delete account?
            </h3>

            <p>
              Your active UniBridge account access
              will be removed.
            </p>

            <p className="account-settings-delete-note">
              Historical transaction records may be
              retained where required for compliance,
              reconciliation, fraud prevention, or
              dispute handling.
            </p>

            {deleteError ? (
              <p
                className="account-settings-delete-error"
                role="alert"
              >
                {deleteError}
              </p>
            ) : null}

            <div className="account-settings-delete-actions">
              <button
                type="button"
                className="account-settings-cancel-button"
                disabled={deleting}
                onClick={() => {
                  setDeleteError("");
                  setConfirmDelete(false);
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                className="account-settings-confirm-delete"
                disabled={
                  deleting ||
                  deleteSucceeded
                }
                onClick={handleDeleteAccount}
              >
                {deleting
                  ? "Deleting…"
                  : "Delete account"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
