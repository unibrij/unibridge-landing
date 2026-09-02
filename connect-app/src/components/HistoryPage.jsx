// connect-app/src/components/HistoryPage.jsx

import {
  useState
} from "react";

import {
  downloadReceiptPdf
} from "../api";

import {
  useHistoryData
} from "./history/useHistoryData.js";

import {
  buildRecipientSummary,
  buildRepeatUrl,
  formatAmount,
  formatDate,
  formatStatus,
  getRecipientInitials,
  getRecipientLabel,
  normalizeStatus,
  normalizeString,
  triggerBlobDownload
} from "./history/historyUtils.js";


function RecipientAvatar({
  item
}) {
  return (
    <div
      className="history-recipient-avatar"
      aria-hidden="true"
    >
      {getRecipientInitials(
        item
      )}
    </div>
  );
}


export default function HistoryPage({
  isConnected = false,
  address
}) {
  const {
    recentPayouts,
    historyStatus,
    historyError,
    retryHistory
  } = useHistoryData({
    isConnected,
    address
  });

  const [
    receiptError,
    setReceiptError
  ] = useState(null);

  const [
    downloadingReceiptId,
    setDownloadingReceiptId
  ] = useState(null);


  async function handleDownloadReceipt({
    item
  }) {
    const receiptId =
      normalizeString(
        item?.receipt_id
      );

    const walletAddress =
      normalizeString(
        address
      );

    if (!receiptId) {
      setReceiptError(
        "Receipt is not available for this payout."
      );

      return;
    }

    if (
      !isConnected ||
      !walletAddress
    ) {
      setReceiptError(
        "Connect your wallet to download this receipt."
      );

      return;
    }

    setReceiptError(
      null
    );

    setDownloadingReceiptId(
      receiptId
    );

    try {
      const result =
        await downloadReceiptPdf({
          receiptId,
          walletAddress
        });

      triggerBlobDownload({
        blob:
          result.blob,

        filename:
          result.filename
      });
    }
    catch (
      error
    ) {
      console.error(
        "RECEIPT_DOWNLOAD_FAILED",
        error
      );

      setReceiptError(
        "Unable to download receipt. Please try again."
      );
    }
    finally {
      setDownloadingReceiptId(
        null
      );
    }
  }


  function handleRetryHistory() {
    setReceiptError(
      null
    );

    retryHistory();
  }


  const hasHistory =
    recentPayouts.length >
      0;

  const walletAddress =
    normalizeString(
      address
    );

  const hasConnectedWallet =
    Boolean(
      isConnected &&
      walletAddress
    );


  return (
    <main className="connect-shell history-shell">
      <header className="connect-brandbar">
        <a
          href="/pay"
          className="connect-brandbar-logo-link"
          aria-label="UniBridge"
        >
          <img
            src="/public/icons/social/unibridge-orbit-lockup-white.png"
            className="connect-brandbar-logo"
            alt="UniBridge"
          />
        </a>
      </header>

      <h1 className="sr-only">
        Payout history
      </h1>

      <nav
        className="connect-tabs"
        aria-label="Connect navigation"
      >
        <a
          href="/connect/"
          className="connect-tab"
        >
          New payout
        </a>

        <span
          className="connect-tab is-active"
          aria-current="page"
        >
          History
        </span>
      </nav>

      <section className="history-content">
        {historyStatus ===
        "disconnected" ? (
          <div className="history-state-card">
            <strong>
              Connect your wallet
            </strong>

            <span>
              Connect the wallet used for your payouts to view history.
            </span>

            <div className="wallet-connect-row">
              <appkit-button />
            </div>
          </div>
        ) : null}

        {historyStatus ===
        "loading" ? (
          <div className="history-state-card">
            <span>
              Loading history...
            </span>
          </div>
        ) : null}

        {historyStatus ===
        "error" ? (
          <div
            className="history-state-card"
            role="alert"
          >
            <strong>
              Could not load history
            </strong>

            <span>
              {historyError ||
                "History could not be loaded."}
            </span>

            <button
              type="button"
              className="history-secondary-button"
              onClick={
                handleRetryHistory
              }
            >
              Try again
            </button>
          </div>
        ) : null}

        {receiptError ? (
          <div
            className="history-state-card"
            role="alert"
          >
            <span>
              {receiptError}
            </span>
          </div>
        ) : null}

        {historyStatus ===
          "ready" &&
        !hasHistory ? (
          <div className="history-state-card">
            <strong>
              No payouts yet
            </strong>

            <span>
              Completed payouts will appear here.
            </span>
          </div>
        ) : null}

        {historyStatus ===
          "ready" &&
        recentPayouts.length >
          0 ? (
          <section
            className="history-section history-payouts-section"
            aria-labelledby="recent-payouts-heading"
          >
            <div className="history-section-header">
              <h2
                id="recent-payouts-heading"
                className="history-section-title"
              >
                Recent payouts
              </h2>
            </div>

            <div className="history-payout-list">
              {recentPayouts.map(
                (
                  payout,
                  index
                ) => {
                  const receiptId =
                    normalizeString(
                      payout
                        ?.receipt_id
                    );

                  const payoutIntentId =
                    normalizeString(
                      payout
                        ?.payout_intent_id
                    );

                  const repeatUrl =
                    buildRepeatUrl(
                      payout
                    );

                  const canDownloadReceipt =
                    Boolean(
                      receiptId &&
                      hasConnectedWallet
                    );

                  const canSendAgain =
                    Boolean(
                      repeatUrl &&
                      hasConnectedWallet
                    );

                  const isDownloading =
                    Boolean(
                      receiptId &&
                      downloadingReceiptId ===
                        receiptId
                    );

                  return (
                    <article
                      className="history-payout-card"
                      key={
                        payoutIntentId ||
                        payout
                          ?.settlement_id ||
                        payout?.id ||
                        index
                      }
                    >
                      <div className="history-payout-header">
                        <div className="history-recipient-main">
                          <RecipientAvatar
                            item={
                              payout
                            }
                          />

                          <div className="history-recipient-copy">
                            <strong className="history-recipient-name">
                              {getRecipientLabel(
                                payout
                              )}
                            </strong>

                            <span className="history-recipient-destination">
                              {buildRecipientSummary(
                                payout
                              )}
                            </span>

                            <span className="history-payout-date">
                              {formatDate(
                                payout
                                  ?.created_at
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="history-payout-summary">
                          <strong className="history-payout-amount">
                            {formatAmount(
                              payout
                            )}
                          </strong>

                          <span
                            className={
                              `history-status-pill history-status-${normalizeStatus(
                                payout
                                  ?.status
                              ) || "unknown"}`
                            }
                          >
                            {formatStatus(
                              payout
                                ?.status
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="history-payout-actions">
                        {canSendAgain ? (
                          <a
                            href={
                              repeatUrl
                            }
                            className="history-secondary-button"
                          >
                            Send again
                          </a>
                        ) : null}

                        {canDownloadReceipt ? (
                          <button
                            type="button"
                            className="history-secondary-button"
                            disabled={
                              isDownloading
                            }
                            onClick={() =>
                              handleDownloadReceipt({
                                item:
                                  payout
                              })
                            }
                          >
                            {isDownloading
                              ? "Downloading..."
                              : "Receipt"}
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
