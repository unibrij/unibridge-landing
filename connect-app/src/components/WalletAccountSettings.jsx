// connect-app/src/components/WalletAccountSettings.jsx

import {
  useEffect,
  useState
} from "react";

import {
  requestAccountDeletionMessage,
  submitAccountDeletion
} from "../api";


function normalizeString(
  value
) {
  return String(
    value ||
    ""
  ).trim();
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


export function WalletAccountSettings({
  open = false,
  walletAddress,
  walletClient,
  onClose,
  onDeleted
} = {}) {
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


  useEffect(() => {
    if (open) {
      return;
    }

    setConfirmDelete(
      false
    );

    setDeleteError(
      ""
    );

    setDeleting(
      false
    );
  }, [
    open
  ]);


  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleKeyDown(
      event
    ) {
      if (
        event.key !==
        "Escape"
      ) {
        return;
      }

      if (deleting) {
        return;
      }

      if (confirmDelete) {
        setConfirmDelete(
          false
        );

        setDeleteError(
          ""
        );

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


  if (!open) {
    return null;
  }


  async function handleDeleteAccount() {
    if (deleting) {
      return;
    }

    const address =
      normalizeString(
        walletAddress
      );

    if (!address) {
      setDeleteError(
        "Wallet address is unavailable."
      );

      return;
    }

    if (
      !walletClient ||
      typeof walletClient.signMessage !==
        "function"
    ) {
      setDeleteError(
        "Wallet signing is unavailable."
      );

      return;
    }

    setDeleting(
      true
    );

    setDeleteError(
      ""
    );

    try {
      const challenge =
        await requestAccountDeletionMessage({
          walletAddress:
            address
        });

      const message =
        normalizeString(
          challenge?.message
        );

      const nonce =
        normalizeString(
          challenge?.nonce
        );

      if (
        !message ||
        !nonce
      ) {
        throw new Error(
          "account_deletion_challenge_invalid"
        );
      }

      const signature =
        await walletClient.signMessage({
          account:
            address,

          message
        });

      await submitAccountDeletion({
        walletAddress:
          address,

        message,
        nonce,
        signature
      });
    } catch (error) {
      setDeleteError(
        normalizeString(
          error?.message
        ) ||
        "Unable to delete account."
      );

      setDeleting(
        false
      );

      return;
    }

    try {
      await onDeleted?.();
    } catch {
      /*
       * Account deletion already succeeded.
       * Do not report cleanup / disconnect failure
       * as an account deletion failure.
       */
    }
  }


  return (
    <div
      className="wallet-account-settings-overlay"
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
        className="wallet-account-settings-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="walletAccountSettingsTitle"
      >
        <header className="wallet-account-settings-header">
          <div>
            <span className="wallet-account-settings-eyebrow">
              UniBridge
            </span>

            <h2 id="walletAccountSettingsTitle">
              Settings
            </h2>
          </div>

          <button
            type="button"
            className="wallet-account-settings-close"
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
          <div className="wallet-account-settings-content">
            <section
              className="
                wallet-account-settings-section
                wallet-account-settings-danger-section
              "
            >
              <h3>
                Danger zone
              </h3>

              <button
                type="button"
                className="wallet-account-settings-delete-action"
                onClick={() => {
                  setDeleteError(
                    ""
                  );

                  setConfirmDelete(
                    true
                  );
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
          <div className="wallet-account-settings-delete-confirmation">
            <div className="wallet-account-settings-delete-icon">
              <TrashIcon />
            </div>

            <h3>
              Delete account?
            </h3>

            <p>
              Your wallet will ask you to sign
              a message confirming this request.
            </p>

            <p className="wallet-account-settings-delete-note">
              Your active UniBridge account access
              and active identity mappings will be
              removed. Historical transaction records
              may be retained where required for
              compliance, reconciliation, fraud
              prevention, or dispute handling.
            </p>

            {deleteError ? (
              <p
                className="wallet-account-settings-delete-error"
                role="alert"
              >
                {deleteError}
              </p>
            ) : null}

            <div className="wallet-account-settings-delete-actions">
              <button
                type="button"
                className="wallet-account-settings-cancel-button"
                disabled={deleting}
                onClick={() => {
                  setDeleteError(
                    ""
                  );

                  setConfirmDelete(
                    false
                  );
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                className="wallet-account-settings-confirm-delete"
                disabled={deleting}
                onClick={
                  handleDeleteAccount
                }
              >
                {deleting
                  ? "Waiting for wallet…"
                  : "Sign and delete"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}


export default WalletAccountSettings;
