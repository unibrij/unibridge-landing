// connect-app/src/components/payout-form/PayoutLifecyclePanel.jsx

import {
  PAYOUT_ATTEMPT_STATE
} from "../../flow/payoutAttempt.js";

import {
  resolveButtonLabel
} from "./routeUtils.js";

function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}

function normalizeLower(
  value
) {
  return normalizeString(
    value
  ).toLowerCase();
}

export default function PayoutLifecyclePanel({
  routeUnavailable,

  isBusy,
  walletConfirmationPending,

  settlement,
  fundingTxHash,

  payoutAttemptState,
  settlementCreationStatus,
  isTransferLocked,

  pricingUnavailable,

  handleSend,
  onNewPayout
}) {
  const normalizedCreationStatus =
    normalizeLower(
      settlementCreationStatus
    );

  const isCreating =
    normalizedCreationStatus ===
    "creating";

  const isReady =
    normalizedCreationStatus ===
    "ready";

  const isLockedResumable =
    payoutAttemptState ===
    PAYOUT_ATTEMPT_STATE
      .LOCKED_RESUMABLE;

  const isLockedRecovery =
    payoutAttemptState ===
    PAYOUT_ATTEMPT_STATE
      .LOCKED_RECOVERY;

  /*
   * READY may already exist in Core while its
   * settlement is not yet hydrated in local state.
   *
   * In that case the user may resume idempotently.
   *
   * Wallet confirmation takes precedence over the
   * generic resume action.
   */
  const canResumeReadyPayout =
    isLockedResumable &&
    isReady &&
    !settlement &&
    !isBusy &&
    !walletConfirmationPending;

  /*
   * CREATING must never trigger another settlement
   * creation request while the backend lease is
   * active.
   *
   * Missing lifecycle status on an otherwise
   * resumable attempt is treated conservatively.
   */
  const waitingForCreation =
    isLockedResumable &&
    !settlement &&
    (
      isCreating ||
      !normalizedCreationStatus
    );

  const defaultButtonLabel =
    resolveButtonLabel({
      isBusy,
      settlement,
      walletConfirmationPending,
      routeUnavailable
    });

  const buttonLabel =
    isLockedRecovery
      ? "Recovery required"
      : waitingForCreation
        ? "Preparing..."
        : canResumeReadyPayout
          ? "Resume payout"
          : defaultButtonLabel;

  /*
   * Transfer locking and execution availability are
   * separate concerns.
   *
   * Wallet confirmation intentionally remains
   * actionable so "Open wallet again" can work.
   */
  const sendDisabled =
    routeUnavailable ||
    pricingUnavailable ||
    isLockedRecovery ||
    waitingForCreation ||
    (
      isBusy &&
      !walletConfirmationPending
    ) ||
    (
      isLockedResumable &&
      !settlement &&
      !isReady
    );

  /*
   * Local setup state should not compete with the
   * wallet-confirmation state.
   */
  const showSettingUpCard =
    !routeUnavailable &&
    isBusy &&
    !walletConfirmationPending &&
    !settlement;

  const showCreatingCard =
    !routeUnavailable &&
    !isBusy &&
    waitingForCreation;

  const showReadyToResumeCard =
    !routeUnavailable &&
    !isBusy &&
    canResumeReadyPayout;

  const showReadyToFundCard =
    !routeUnavailable &&
    !isBusy &&
    !isLockedRecovery &&
    Boolean(
      settlement?.funding
    ) &&
    !fundingTxHash;

  const showRecoveryCard =
    !routeUnavailable &&
    !isBusy &&
    isLockedRecovery;

  /*
   * Once transfer details are locked, the current
   * payout has crossed the editable-draft boundary.
   *
   * Starting a new payout is an explicit user action
   * and remains available independently of local
   * in-flight work, including wallet confirmation.
   */
  const showNewPayout =
    isTransferLocked &&
    typeof onNewPayout ===
      "function";

  return (
    <>
      {routeUnavailable ? (
        <div className="wallet-pending-card">
          <strong>
            Coming soon
          </strong>

          <span>
            This payout corridor is not available yet.
          </span>
        </div>
      ) : null}

      {showSettingUpCard ? (
        <div className="wallet-pending-card">
          <strong>
            Setting up your payout…
          </strong>

          <span>
            Transfer details are locked while we prepare your payout.
          </span>
        </div>
      ) : null}

      {showCreatingCard ? (
        <div className="wallet-pending-card">
          <strong>
            Setting up your payout…
          </strong>

          <span>
            Your payout is still being prepared. No action is required yet.
          </span>
        </div>
      ) : null}

      {showReadyToResumeCard ? (
        <div className="wallet-pending-card">
          <strong>
            Payout ready
          </strong>

          <span>
            Continue to load the existing funding instructions.
          </span>
        </div>
      ) : null}

      {showReadyToFundCard ? (
        <div className="wallet-pending-card">
          <strong>
            Ready to fund
          </strong>

          <span>
            Your payout is prepared. Transfer details can no longer be changed.
          </span>
        </div>
      ) : null}

      {showRecoveryCard ? (
        <div className="wallet-pending-card">
          <strong>
            Payout needs attention
          </strong>

          <span>
            This payout cannot be retried automatically. Transfer details remain locked.
          </span>
        </div>
      ) : null}

      <button
        type="button"
        onClick={
          handleSend
        }
        disabled={
          sendDisabled
        }
      >
        {buttonLabel}
      </button>

      {showNewPayout ? (
        <button
          type="button"
          className="new-payout-button"
          onClick={
            onNewPayout
          }
        >
          New payout
        </button>
      ) : null}

      {walletConfirmationPending &&
      !fundingTxHash ? (
        <div className="wallet-pending-card">
          <strong>
            Wallet confirmation pending
          </strong>

          <span>
            Return to your wallet and confirm the transaction.
          </span>
        </div>
      ) : null}
    </>
  );
}
