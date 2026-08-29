// connect-app/src/components/HistoryPage.jsx

import {
  useEffect,
  useState
} from "react";

import {
  downloadReceiptPdf,
  getPayoutHistory
} from "../api";

function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}

function normalizeStatus(
  status
) {
  return normalizeString(
    status
  ).toLowerCase();
}

function formatStatus(
  status
) {
  const normalized =
    normalizeStatus(
      status
    );

  const labels = {
    completed:
      "Completed",

    complete:
      "Completed",

    executed:
      "Completed",

    success:
      "Completed",

    succeeded:
      "Completed",

    payout_completed:
      "Completed",

    execution_completed:
      "Completed",

    processing:
      "Processing",

    pending:
      "Pending",

    failed:
      "Failed"
  };

  if (
    labels[normalized]
  ) {
    return labels[
      normalized
    ];
  }

  if (!normalized) {
    return "—";
  }

  return normalized
    .replace(
      /_/g,
      " "
    )
    .replace(
      /\b\w/g,
      character =>
        character.toUpperCase()
    );
}

function formatAmount(
  item
) {
  const amount =
    normalizeString(
      item?.amount
    );

  const asset =
    normalizeString(
      item?.asset
    );

  if (!amount) {
    return "—";
  }

  return asset
    ? `${amount} ${asset}`
    : amount;
}

function resolveDate(
  value
) {
  if (!value) {
    return null;
  }

  if (
    typeof value ===
      "string" ||
    typeof value ===
      "number"
  ) {
    const date =
      new Date(
        value
      );

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;
  }

  const seconds =
    value?._seconds ??
    value?.seconds;

  if (
    Number.isFinite(
      Number(
        seconds
      )
    )
  ) {
    const date =
      new Date(
        Number(
          seconds
        ) *
        1000
      );

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;
  }

  return null;
}

function formatDate(
  value
) {
  const date =
    resolveDate(
      value
    );

  if (!date) {
    return "—";
  }

  try {
    return date
      .toLocaleDateString(
        undefined,
        {
          year:
            "numeric",

          month:
            "short",

          day:
            "numeric"
        }
      );
  }
  catch {
    return "—";
  }
}

function getRecipientLabel(
  item
) {
  return (
    normalizeString(
      item
        ?.recipient_display
        ?.label
    ) ||
    "Recipient"
  );
}

function getRecipientDestination(
  item
) {
  return normalizeString(
    item
      ?.recipient_display
      ?.destination
  );
}

function getMaskedIdentifier(
  item
) {
  return normalizeString(
    item
      ?.recipient_display
      ?.masked_identifier
  );
}

function buildRecipientSummary(
  item
) {
  return [
    getRecipientDestination(
      item
    ),

    getMaskedIdentifier(
      item
    )
  ]
    .filter(
      Boolean
    )
    .join(
      " · "
    ) ||
    "Saved payout recipient";
}

function getRecipientInitials(
  item
) {
  const label =
    getRecipientLabel(
      item
    );

  const words =
    label
      .split(
        /\s+/
      )
      .filter(
        Boolean
      );

  if (
    words.length === 0
  ) {
    return "UB";
  }

  if (
    words.length === 1
  ) {
    return words[0]
      .slice(
        0,
        2
      )
      .toUpperCase();
  }

  return (
    words[0][0] +
    words[
      words.length -
      1
    ][0]
  ).toUpperCase();
}

function buildRepeatUrl(
  item
) {
  const sourcePayoutIntentId =
    normalizeString(
      item
        ?.repeat_source_payout_intent_id ||
      item?.payout_intent_id
    );

  const routeId =
    normalizeString(
      item?.route_id
    );

  if (
    !sourcePayoutIntentId ||
    !routeId ||
    item?.repeat_available ===
      false
  ) {
    return null;
  }

  const params =
    new URLSearchParams({
      repeat_source_payout_intent_id:
        sourcePayoutIntentId,

      route_id:
        routeId
    });

  return `/connect/?${params.toString()}`;
}

function triggerBlobDownload({
  blob,
  filename
}) {
  const objectUrl =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      "a"
    );

  link.href =
    objectUrl;

  link.download =
    filename ||
    "unibridge-receipt.pdf";

  document.body.appendChild(
    link
  );

  link.click();

  link.remove();

  globalThis.setTimeout(
    () => {
      URL.revokeObjectURL(
        objectUrl
      );
    },
    0
  );
}

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
  accessToken
}) {
  const [
    recentPayouts,
    setRecentPayouts
  ] = useState([]);

  const [
    historyStatus,
    setHistoryStatus
  ] = useState("idle");

  const [
    historyError,
    setHistoryError
  ] = useState(null);

  const [
    receiptError,
    setReceiptError
  ] = useState(null);

  const [
    downloadingReceiptId,
    setDownloadingReceiptId
  ] = useState(null);

  useEffect(() => {
    let cancelled =
      false;

    if (!accessToken) {
      setRecentPayouts(
        []
      );

      setHistoryStatus(
        "unavailable"
      );

      setHistoryError(
        null
      );

      return () => {
        cancelled =
          true;
      };
    }

    async function loadHistory() {
      setHistoryStatus(
        "loading"
      );

      setHistoryError(
        null
      );

      try {
        const result =
          await getPayoutHistory({
            accessToken,
            limit:
              20
          });

        if (cancelled) {
          return;
        }

        setRecentPayouts(
          Array.isArray(
            result
              ?.recent_payouts
          )
            ? result
                .recent_payouts
            : []
        );

        setHistoryStatus(
          "ready"
        );
      }
      catch (
        error
      ) {
        if (cancelled) {
          return;
        }

        setRecentPayouts(
          []
        );

        setHistoryStatus(
          "error"
        );

        setHistoryError(
          error?.message ||
          "get_payout_history_failed"
        );
      }
    }

    void loadHistory();

    return () => {
      cancelled =
        true;
    };
  }, [
    accessToken
  ]);

  async function handleDownloadReceipt({
    item
  }) {
    const receiptId =
      normalizeString(
        item?.receipt_id
      );

    if (!receiptId) {
      setReceiptError(
        "Receipt is not available for this payout."
      );

      return;
    }

    if (!accessToken) {
      setReceiptError(
        "Receipt access is unavailable."
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
          accessToken
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

  const hasHistory =
    recentPayouts.length >
      0;

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
        "unavailable" ? (
          <div className="history-state-card">
            <strong>
              History unavailable
            </strong>

            <span>
              This session does not have access to payout history.
            </span>
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
                      accessToken
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
                        {repeatUrl ? (
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
