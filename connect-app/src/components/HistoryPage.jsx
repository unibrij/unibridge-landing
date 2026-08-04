// connect-app/src/components/HistoryPage.jsx

import {
  useEffect,
  useState
} from "react";

import {
  downloadReceiptPdf,
  getWalletPayoutHistory
} from "../api";

import {
  readRouteHistory,
  mergeRouteHistoryItems
} from "../history/routeHistory";

import {
  readPayoutAccessToken
} from "../flow/payoutAccessTokenStorage";

function shortId(
  value = ""
) {
  const text =
    String(
      value ||
      ""
    ).trim();

  if (!text) {
    return "—";
  }

  if (
    text.length <=
    18
  ) {
    return text;
  }

  return `${text.slice(
    0,
    8
  )}...${text.slice(
    -6
  )}`;
}

function normalizeStatus(
  status = ""
) {
  return String(
    status ||
    ""
  )
    .trim()
    .toLowerCase();
}

function isSuccessStatus(
  status = ""
) {
  return [
    "completed",
    "complete",
    "executed",
    "success",
    "succeeded",
    "payout_completed",
    "execution_completed"
  ].includes(
    normalizeStatus(
      status
    )
  );
}

function formatStatus(
  status = ""
) {
  const value =
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
      "Completed"
  };

  return (
    labels[value] ||
    value ||
    "—"
  );
}

function formatAmount(
  item
) {
  const amount =
    String(
      item?.amount ||
      ""
    ).trim();

  const asset =
    String(
      item?.asset ||
      ""
    ).trim();

  if (!amount) {
    return "—";
  }

  return `${amount}${
    asset
      ? ` ${asset}`
      : ""
  }`;
}

function formatDate(
  value
) {
  if (!value) {
    return "—";
  }

  try {
    const date =
      typeof value ===
        "string" ||
      typeof value ===
        "number"
        ? new Date(
            value
          )
        : value?._seconds
          ? new Date(
              value._seconds *
              1000
            )
          : value?.seconds
            ? new Date(
                value.seconds *
                1000
              )
            : null;

    if (
      !date ||
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "—";
    }

    return date
      .toLocaleDateString(
        undefined,
        {
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

function completedOnly(
  items = []
) {
  return items.filter(
    item =>
      isSuccessStatus(
        item?.status
      )
  );
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
  walletAddress
}) {
  const [
    history,
    setHistory
  ] = useState(
    () =>
      completedOnly(
        readRouteHistory()
      )
  );

  const [
    downloadingReceiptId,
    setDownloadingReceiptId
  ] = useState(
    null
  );

  const [
    receiptError,
    setReceiptError
  ] = useState(
    null
  );

  useEffect(() => {
    let cancelled =
      false;

    async function syncWalletHistory() {
      if (!walletAddress) {
        return;
      }

      try {
        const items =
          await getWalletPayoutHistory({
            walletAddress,
            limit:
              20
          });

        if (cancelled) {
          return;
        }

        const merged =
          mergeRouteHistoryItems(
            items
          );

        setHistory(
          completedOnly(
            merged
          )
        );
      }
      catch {
        if (!cancelled) {
          setHistory(
            completedOnly(
              readRouteHistory()
            )
          );
        }
      }
    }

    void syncWalletHistory();

    return () => {
      cancelled =
        true;
    };
  }, [
    walletAddress
  ]);

  async function handleDownloadReceipt(
    item
  ) {
    const receiptId =
      String(
        item?.receipt_id ||
        ""
      ).trim();

    const payoutIntentId =
      String(
        item?.payout_intent_id ||
        ""
      ).trim();

    if (
      !receiptId ||
      !payoutIntentId
    ) {
      setReceiptError(
        "Receipt is not available for this payout."
      );

      return;
    }

    const storedAccess =
      readPayoutAccessToken(
        payoutIntentId
      );

    const accessToken =
      typeof storedAccess ===
        "string"
        ? storedAccess
        : storedAccess?.access_token ||
          storedAccess?.token ||
          null;

    if (!accessToken) {
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
      err
    ) {
      setReceiptError(
        err?.message ||
        "receipt_download_failed"
      );
    }
    finally {
      setDownloadingReceiptId(
        null
      );
    }
  }

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
      </header>

      <h1 className="sr-only">
        Payout history
      </h1>

      <p className="connect-eyebrow">
        Payout history
      </p>

      <section className="payout-form">
        {receiptError ? (
          <p
            className="history-empty"
            role="alert"
          >
            {receiptError}
          </p>
        ) : null}

        {history.length ===
        0 ? (
          <p className="history-empty">
            No completed payouts yet.
          </p>
        ) : (
          <div className="history-list">
            {history.map(
              (
                item,
                index
              ) => {
                const receiptId =
                  item
                    ?.receipt_id ||
                  null;

                const payoutIntentId =
                  item
                    ?.payout_intent_id ||
                  null;

                const canDownloadReceipt =
                  Boolean(
                    receiptId &&
                    payoutIntentId
                  );

                const isDownloading =
                  Boolean(
                    receiptId &&
                    downloadingReceiptId ===
                      receiptId
                  );

                return (
                  <div
                    className="history-card"
                    key={
                      item
                        .payout_intent_id ||
                      item
                        .settlement_id ||
                      item.id ||
                      index
                    }
                  >
                    <div className="history-row">
                      <span>
                        Reference ID
                      </span>

                      <strong>
                        {shortId(
                          item
                            .public_reference ||
                          item.route_id ||
                          item
                            .settlement_id
                        )}
                      </strong>
                    </div>

                    <div className="history-row">
                      <span>
                        Corridor
                      </span>

                      <strong>
                        {item.corridor ||
                          "—"}
                      </strong>
                    </div>

                    <div className="history-row">
                      <span>
                        Amount
                      </span>

                      <strong>
                        {formatAmount(
                          item
                        )}
                      </strong>
                    </div>

                    <div className="history-row">
                      <span>
                        Status
                      </span>

                      <strong className="history-status-success">
                        {formatStatus(
                          item.status
                        )}
                      </strong>
                    </div>

                    <div className="history-row">
                      <span>
                        Date
                      </span>

                      <strong>
                        {formatDate(
                          item
                            .created_at
                        )}
                      </strong>
                    </div>

                    {canDownloadReceipt ? (
                      <button
                        type="button"
                        className="route-action-link history-receipt-link"
                        disabled={
                          isDownloading
                        }
                        onClick={() =>
                          handleDownloadReceipt(
                            item
                          )
                        }
                      >
                        {isDownloading
                          ? "Downloading..."
                          : "Download receipt"}
                      </button>
                    ) : null}
                  </div>
                );
              }
            )}
          </div>
        )}

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
