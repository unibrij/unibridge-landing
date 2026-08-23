// partials/pay/js/pay-history.js

import {
  buildHistoryRecipientSummary,
  buildRepeatParams,
  downloadReceiptPdf,
  formatHistoryAmount,
  formatHistoryDate,
  formatHistoryStatus,
  getHistoryRecipientInitials,
  getHistoryRecipientLabel,
  getPayoutHistory,
  normalizeStatus
} from "/shared/pay/history/history.js";


/*
--------------------------------------------------
DOM helpers
--------------------------------------------------
*/

function requireElement(
  id
) {
  const element =
    document.getElementById(
      id
    );

  if (!element) {
    throw new Error(
      `missing_history_element:${id}`
    );
  }

  return element;
}

function setHidden(
  element,
  hidden
) {
  element.hidden =
    Boolean(
      hidden
    );
}

function clearElement(
  element
) {
  while (
    element.firstChild
  ) {
    element.removeChild(
      element.firstChild
    );
  }
}

function createElement(
  tag,
  {
    className,
    text
  } = {}
) {
  const element =
    document.createElement(
      tag
    );

  if (className) {
    element.className =
      className;
  }

  if (
    text !==
      undefined &&
    text !==
      null
  ) {
    element.textContent =
      String(
        text
      );
  }

  return element;
}


/*
--------------------------------------------------
Status helpers
--------------------------------------------------
*/

function resolveStatusClass(
  status
) {
  const normalized =
    normalizeStatus(
      status
    );

  if (
    normalized ===
      "completed" ||
    normalized ===
      "complete" ||
    normalized ===
      "executed" ||
    normalized ===
      "success" ||
    normalized ===
      "succeeded" ||
    normalized ===
      "payout_completed" ||
    normalized ===
      "execution_completed"
  ) {
    return "is-completed";
  }

  if (
    normalized ===
      "failed"
  ) {
    return "is-failed";
  }

  return "is-pending";
}


/*
--------------------------------------------------
Payout projection
--------------------------------------------------
*/

function resolveReceiptId(
  item
) {
  return String(
    item?.receipt_id ||
    ""
  ).trim();
}

function resolvePayoutDate(
  item
) {
  return (
    item?.completed_at ||
    item?.updated_at ||
    item?.created_at ||
    null
  );
}


/*
--------------------------------------------------
Receipt download
--------------------------------------------------
*/

function triggerBlobDownload({
  blob,
  filename
}) {
  const url =
    URL.createObjectURL(
      blob
    );

  const anchor =
    document.createElement(
      "a"
    );

  anchor.href =
    url;

  anchor.download =
    filename;

  anchor.style.display =
    "none";

  document.body.appendChild(
    anchor
  );

  anchor.click();

  anchor.remove();

  setTimeout(
    () => {
      URL.revokeObjectURL(
        url
      );
    },
    0
  );
}


/*
--------------------------------------------------
Payout card
--------------------------------------------------
*/

function buildPayoutCard({
  item,
  accessToken,
  buildRepeatUrl,
  onReceiptError
}) {
  const card =
    createElement(
      "article",
      {
        className:
          "history-payout-card"
      }
    );

  const main =
    createElement(
      "div",
      {
        className:
          "history-payout-main"
      }
    );

  const identity =
    createElement(
      "div",
      {
        className:
          "history-recipient-identity"
      }
    );

  const avatar =
    createElement(
      "div",
      {
        className:
          "history-recipient-avatar",

        text:
          getHistoryRecipientInitials(
            item
          )
      }
    );

  avatar.setAttribute(
    "aria-hidden",
    "true"
  );

  const recipientText =
    createElement(
      "div",
      {
        className:
          "history-recipient-text"
      }
    );

  const recipientName =
    createElement(
      "strong",
      {
        className:
          "history-recipient-name",

        text:
          getHistoryRecipientLabel(
            item
          )
      }
    );

  const recipientSummary =
    createElement(
      "span",
      {
        className:
          "history-recipient-summary",

        text:
          buildHistoryRecipientSummary(
            item
          )
      }
    );

  recipientText.append(
    recipientName,
    recipientSummary
  );

  identity.append(
    avatar,
    recipientText
  );

  const details =
    createElement(
      "div",
      {
        className:
          "history-payout-details"
      }
    );

  const amount =
    createElement(
      "strong",
      {
        className:
          "history-payout-amount",

        text:
          formatHistoryAmount(
            item
          )
      }
    );

  const meta =
    createElement(
      "div",
      {
        className:
          "history-payout-meta"
      }
    );

  const status =
    createElement(
      "span",
      {
        className:
          `history-status ${resolveStatusClass(
            item?.status
          )}`,

        text:
          formatHistoryStatus(
            item?.status
          )
      }
    );

  const date =
    createElement(
      "span",
      {
        className:
          "history-payout-date",

        text:
          formatHistoryDate(
            resolvePayoutDate(
              item
            )
          )
      }
    );

  meta.append(
    status,
    date
  );

  details.append(
    amount,
    meta
  );

  main.append(
    identity,
    details
  );

  card.appendChild(
    main
  );

  const actions =
    createElement(
      "div",
      {
        className:
          "history-payout-actions"
      }
    );

  const repeatParams =
    buildRepeatParams(
      item
    );

  if (
    repeatParams &&
    typeof buildRepeatUrl ===
      "function"
  ) {
    const repeatUrl =
      buildRepeatUrl({
        item,
        params:
          repeatParams
      });

    if (repeatUrl) {
      const repeatLink =
        createElement(
          "a",
          {
            className:
              "history-action-button",

            text:
              "Send again"
          }
        );

      repeatLink.href =
        repeatUrl;

      actions.appendChild(
        repeatLink
      );
    }
  }

  const receiptId =
    resolveReceiptId(
      item
    );

  if (
    receiptId &&
    accessToken
  ) {
    const receiptButton =
      createElement(
        "button",
        {
          className:
            "history-action-button history-receipt-button",

          text:
            "Receipt"
        }
      );

    receiptButton.type =
      "button";

    receiptButton.addEventListener(
      "click",
      async () => {
        const previousLabel =
          receiptButton.textContent;

        receiptButton.disabled =
          true;

        receiptButton.textContent =
          "Downloading...";

        try {
          const result =
            await downloadReceiptPdf({
              receiptId,
              accessToken
            });

          triggerBlobDownload(
            result
          );
        }
        catch (
          error
        ) {
          onReceiptError(
            error
          );
        }
        finally {
          receiptButton.disabled =
            false;

          receiptButton.textContent =
            previousLabel;
        }
      }
    );

    actions.appendChild(
      receiptButton
    );
  }

  if (
    actions.childElementCount >
    0
  ) {
    card.appendChild(
      actions
    );
  }

  return card;
}


/*
--------------------------------------------------
History controller
--------------------------------------------------
*/

export async function initPayHistory({
  partner,
  accessToken,
  buildRepeatUrl,
  limit = 20
}) {
  const root =
    requireElement(
      "payHistory"
    );

  const unavailable =
    requireElement(
      "payHistoryUnavailable"
    );

  const loading =
    requireElement(
      "payHistoryLoading"
    );

  const error =
    requireElement(
      "payHistoryError"
    );

  const errorMessage =
    requireElement(
      "payHistoryErrorMessage"
    );

  const receiptError =
    requireElement(
      "payHistoryReceiptError"
    );

  const receiptErrorMessage =
    requireElement(
      "payHistoryReceiptErrorMessage"
    );

  const empty =
    requireElement(
      "payHistoryEmpty"
    );

  const payouts =
    requireElement(
      "payHistoryPayouts"
    );

  const payoutList =
    requireElement(
      "payHistoryPayoutList"
    );

  function hideStates() {
    setHidden(
      unavailable,
      true
    );

    setHidden(
      loading,
      true
    );

    setHidden(
      error,
      true
    );

    setHidden(
      empty,
      true
    );

    setHidden(
      payouts,
      true
    );
  }

  function hideReceiptError() {
    setHidden(
      receiptError,
      true
    );
  }

  function showReceiptError(
    requestError
  ) {
    receiptErrorMessage.textContent =
      requestError?.message ||
      "Unable to download receipt. Please try again.";

    setHidden(
      receiptError,
      false
    );
  }

  clearElement(
    payoutList
  );

  hideStates();
  hideReceiptError();

  if (!accessToken) {
    setHidden(
      unavailable,
      false
    );

    return {
      destroy() {}
    };
  }

  setHidden(
    loading,
    false
  );

  try {
    const data =
      await getPayoutHistory({
        partner,
        accessToken,
        limit
      });

    const recentPayouts =
      Array.isArray(
        data?.recent_payouts
      )
        ? data.recent_payouts
        : [];

    setHidden(
      loading,
      true
    );

    if (
      recentPayouts.length ===
      0
    ) {
      setHidden(
        empty,
        false
      );

      return {
        destroy() {}
      };
    }

    for (
      const item of
        recentPayouts
    ) {
      payoutList.appendChild(
        buildPayoutCard({
          item,
          accessToken,
          buildRepeatUrl,

          onReceiptError:
            showReceiptError
        })
      );
    }

    setHidden(
      payouts,
      false
    );
  }
  catch (
    requestError
  ) {
    setHidden(
      loading,
      true
    );

    errorMessage.textContent =
      requestError?.message ||
      "History could not be loaded.";

    setHidden(
      error,
      false
    );
  }

  return {
    root,

    destroy() {
      clearElement(
        payoutList
      );

      hideStates();
      hideReceiptError();
    }
  };
}
