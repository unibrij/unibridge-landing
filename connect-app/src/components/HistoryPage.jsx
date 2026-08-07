// connect-app/src/components/HistoryPage.jsx

import {
  useEffect,
  useState
} from "react";

import {
  downloadReceiptPdf,
  getPayoutHistory
} from "../api";

import {
  readPayoutAccessToken
} from "../flow/payoutAccessTokenStorage";

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
    .filter(Boolean)
    .join(" · ") ||
    "Saved payout recipient";
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

export default function HistoryPage({
  accessToken
}) {
  const [
    recentRecipients,
    setRecentRecipients
  ] = useState([]);

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
      setRecentRecipients(
        []
      );

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

        setRecentRecipients(
          result
            .recent_recipients
        );

        setRecentPayouts(
          result
            .recent_payouts
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

        setRecentRecipients(
          []
        );

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
    item,
    accessToken:
      receiptAccessToken
  }) {
    const receiptId =
      normalizeString(
        item?.receipt_id
      );

    const payoutIntentId =
      normalizeString(
        item
          ?.payout_intent_id
      );

    if (
      !receiptId ||
      !payoutIntentId
    ) {
      setReceiptError(
        "Receipt is not available for this payout."
      );

      return;
    }

    if (
      !receiptAccessToken
    ) {
      setReceiptError(
        "Receipt access has expired or is unavailable."
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

          accessToken:
            receiptAccessToken
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
      setReceiptError(
        error?.message ||
        "receipt_download_failed"
      );
    }
    finally {
      setDownloadingReceiptId(
        null
      );
    }
  }

  const hasHistory =
    recentRecipients.length >
      0 ||
    recentPayouts.length >
      0;

  return (
    <main className="connect-shell history-shell">
      <header className="connect-brandbar">
        <a
          href="/connect"
          className="connect-brandbar-logo-link"
          aria-label="Pay with UniBridge"
        >
          <img
            src="/public/icons/social/unibridge-orbit-lockup-white.png"
            className="connect-brandbar-logo"
            alt="UniBridge"
          />
        </a>

        <a
          href="/"
          className="connect-domain-pill"
          aria-label="UniBridge website"
        >
          Unibrij.io
        </a>
      </header>

      <h1 className="sr-only">
        Payout history
      </h1>

      <p className="connect-eyebrow">
        History
      </p>

      <nav
        className="connect-view-navigation"
        aria-label="Connect navigation"
      >
        <a
          href="/connect/"
          className="route-action-link"
        >
          New payout
        </a>

        <span
          className="route-action-link"
          aria-current="page"
        >
          History
        </span>
      </nav>

      <section className="payout-form">
        {historyStatus ===
        "unavailable" ? (
          <p className="history-empty">
            History unavailable for this session.
          </p>
        ) : null}

        {historyStatus ===
        "loading" ? (
          <p className="history-empty">
            Loading history...
          </p>
        ) : null}

        {historyStatus ===
        "error" ? (
          <p
            className="history-empty"
            role="alert"
          >
            {historyError ||
              "History could not be loaded."}
          </p>
        ) : null}

        {receiptError ? (
          <p
            className="history-empty"
            role="alert"
          >
            {receiptError}
          </p>
        ) : null}

        {historyStatus ===
          "ready" &&
        !hasHistory ? (
          <p className="history-empty">
            No completed payouts yet.
          </p>
        ) : null}

        {historyStatus ===
          "ready" &&
        recentRecipients.length >
          0 ? (
          <section
            className="history-section"
            aria-labelledby="recent-recipients-heading"
          >
            <h2
              id="recent-recipients-heading"
              className="history-section-title"
            >
              Recent recipients
            </h2>

            <div className="history-list">
              {recentRecipients.map(
                (
                  recipient,
                  index
                ) => {
                  const repeatUrl =
                    buildRepeatUrl(
                      recipient
                    );

                  return (
                    <article
                      className="history-card"
                      key={
                        recipient
                          ?.repeat_source_payout_intent_id ||
                        `${recipient?.route_id || "recipient"}-${index}`
                      }
                    >
                      <div className="history-row">
                        <span>
                          Recipient
                        </span>

                        <strong>
                          {getRecipientLabel(
                            recipient
                          )}
                        </strong>
                      </div>

                      <div className="history-row">
                        <span>
                          Destination
                        </span>

                        <strong>
                          {buildRecipientSummary(
                            recipient
                          )}
                        </strong>
                      </div>

                      <div className="history-row">
                        <span>
                          Last paid
                        </span>

                        <strong>
                          {formatDate(
                            recipient
                              ?.last_paid_at
                          )}
                        </strong>
                      </div>

                      {repeatUrl ? (
                        <a
                          href={
                            repeatUrl
                          }
                          className="route-action-link history-repeat-link"
                        >
                          Send again
                        </a>
                      ) : null}
                    </article>
                  );
                }
              )}
            </div>
          </section>
        ) : null}

        {historyStatus ===
          "ready" &&
        recentPayouts.length >
          0 ? (
          <section
            className="history-section"
            aria-labelledby="recent-payouts-heading"
          >
            <h2
              id="recent-payouts-heading"
              className="history-section-title"
            >
              Recent payouts
            </h2>

            <div className="history-list">
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

                  const storedReceiptAccess =
                    payoutIntentId
                      ? readPayoutAccessToken(
                          payoutIntentId
                        )
                      : null;

                  const receiptAccessToken =
                    storedReceiptAccess
                      ?.token ||
                    null;

                  const canDownloadReceipt =
                    Boolean(
                      receiptId &&
                      payoutIntentId &&
                      receiptAccessToken
                    );

                  const isDownloading =
                    Boolean(
                      receiptId &&
                      downloadingReceiptId ===
                        receiptId
                    );

                  return (
                    <article
                      className="history-card"
                      key={
                        payoutIntentId ||
                        payout
                          ?.settlement_id ||
                        payout?.id ||
                        index
                      }
                    >
                      <div className="history-row">
                        <span>
                          Recipient
                        </span>

                        <strong>
                          {getRecipientLabel(
                            payout
                          )}
                        </strong>
                      </div>

                      <div className="history-row">
                        <span>
                          Destination
                        </span>

                        <strong>
                          {buildRecipientSummary(
                            payout
                          )}
                        </strong>
                      </div>

                      <div className="history-row">
                        <span>
                          Amount
                        </span>

                        <strong>
                          {formatAmount(
                            payout
                          )}
                        </strong>
                      </div>

                      <div className="history-row">
                        <span>
                          Status
                        </span>

                        <strong className="history-status-success">
                          {formatStatus(
                            payout
                              ?.status
                          )}
                        </strong>
                      </div>

                      <div className="history-row">
                        <span>
                          Date
                        </span>

                        <strong>
                          {formatDate(
                            payout
                              ?.created_at
                          )}
                        </strong>
                      </div>

                      <div className="history-card-actions">
                        {repeatUrl ? (
                          <a
                            href={
                              repeatUrl
                            }
                            className="route-action-link history-repeat-link"
                          >
                            Send again
                          </a>
                        ) : null}

                        {canDownloadReceipt ? (
                          <button
                            type="button"
                            className="route-action-link history-receipt-link"
                            disabled={
                              isDownloading
                            }
                            onClick={() =>
                              handleDownloadReceipt({
                                item:
                                  payout,

                                accessToken:
                                  receiptAccessToken
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

        <a
          href="/connect/"
          className="route-action-link history-back-link"
        >
          Back to payout
        </a>
      </section>
    </main>
  );
}
