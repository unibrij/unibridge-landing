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


function clearElement(
  element
) {
  element.replaceChildren();
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
    text !== undefined &&
    text !== null
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
    item?.created_at ||
    null
  );
}


/*
--------------------------------------------------
Shared status presentation

History statuses are canonical payout lifecycle
statuses.

The visual treatment is intentionally provider-
agnostic and maps those statuses into the existing
shared History CSS states.
--------------------------------------------------
*/

function resolveStatusClass(
  status
) {
  const normalized =
    normalizeStatus(
      status
    );

  const completedStatuses =
    new Set([
      "completed",
      "complete",
      "executed",
      "success",
      "succeeded",
      "payout_completed",
      "execution_completed"
    ]);

  const failedStatuses =
    new Set([
      "failed",
      "funds_returned"
    ]);

  if (
    completedStatuses.has(
      normalized
    )
  ) {
    return "is-completed";
  }

  if (
    failedStatuses.has(
      normalized
    )
  ) {
    return "is-failed";
  }

  return "is-pending";
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


/*
--------------------------------------------------
State rendering
--------------------------------------------------
*/

function buildStateCard({
  title,
  message,
  role
}) {
  const card =
    createElement(
      "div",
      {
        className:
          "history-state-card"
      }
    );

  if (role) {
    card.setAttribute(
      "role",
      role
    );
  }

  if (title) {
    card.appendChild(
      createElement(
        "strong",
        {
          text:
            title
        }
      )
    );
  }

  if (message) {
    card.appendChild(
      createElement(
        "span",
        {
          text:
            message
        }
      )
    );
  }

  return card;
}


function renderState(
  root,
  {
    title,
    message,
    role
  }
) {
  clearElement(
    root
  );

  root.appendChild(
    buildStateCard({
      title,
      message,
      role
    })
  );
}


/*
--------------------------------------------------
Recipient
--------------------------------------------------
*/

function buildRecipientIdentity(
  item
) {
  const recipientIdentity =
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

  recipientIdentity.append(
    avatar,
    recipientText
  );

  return recipientIdentity;
}


/*
--------------------------------------------------
Payout details
--------------------------------------------------
*/

function buildPayoutDetails(
  item
) {
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

  const payoutDate =
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

  meta.append(
    payoutDate,
    status
  );

  details.append(
    amount,
    meta
  );

  return details;
}


/*
--------------------------------------------------
Payout actions
--------------------------------------------------
*/

function buildPayoutActions({
  item,
  accessToken,
  buildRepeatUrl,
  onReceiptError
}) {
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
            "history-action-button",

          text:
            "Receipt"
        }
      );

    receiptButton.type =
      "button";

    receiptButton.addEventListener(
      "click",
      async () => {
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

          onReceiptError();
        }
        finally {
          receiptButton.disabled =
            false;

          receiptButton.textContent =
            "Receipt";
        }
      }
    );

    actions.appendChild(
      receiptButton
    );
  }

  return actions;
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

  main.append(
    buildRecipientIdentity(
      item
    ),

    buildPayoutDetails(
      item
    )
  );

  card.append(
    main,

    buildPayoutActions({
      item,
      accessToken,
      buildRepeatUrl,
      onReceiptError
    })
  );

  return card;
}


/*
--------------------------------------------------
Ready history
--------------------------------------------------
*/

function renderPayoutHistory({
  root,
  payouts,
  accessToken,
  buildRepeatUrl,
  onReceiptError
}) {
  clearElement(
    root
  );

  const section =
    createElement(
      "section",
      {
        className:
          "history-section history-payouts-section"
      }
    );

  section.setAttribute(
    "aria-labelledby",
    "recent-payouts-heading"
  );

  const header =
    createElement(
      "div",
      {
        className:
          "history-section-header"
      }
    );

  const title =
    createElement(
      "h2",
      {
        className:
          "history-section-title",

        text:
          "Recent payouts"
      }
    );

  title.id =
    "recent-payouts-heading";

  header.appendChild(
    title
  );

  const list =
    createElement(
      "div",
      {
        className:
          "history-payout-list"
      }
    );

  for (
    const item of
      payouts
  ) {
    list.appendChild(
      buildPayoutCard({
        item,
        accessToken,
        buildRepeatUrl,
        onReceiptError
      })
    );
  }

  section.append(
    header,
    list
  );

  root.appendChild(
    section
  );
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

  let destroyed =
    false;

  let receiptErrorCard =
    null;


  function removeReceiptError() {
    if (!receiptErrorCard) {
      return;
    }

    receiptErrorCard.remove();

    receiptErrorCard =
      null;
  }


  function showReceiptError() {
    if (destroyed) {
      return;
    }

    removeReceiptError();

    receiptErrorCard =
      buildStateCard({
        message:
          "Unable to download receipt. Please try again.",

        role:
          "alert"
      });

    root.prepend(
      receiptErrorCard
    );
  }


  clearElement(
    root
  );


  if (!accessToken) {
    renderState(
      root,
      {
        title:
          "History unavailable",

        message:
          "This session does not have access to payout history."
      }
    );

    return {
      root,

      destroy() {
        destroyed =
          true;

        clearElement(
          root
        );
      }
    };
  }


  renderState(
    root,
    {
      message:
        "Loading history..."
    }
  );


  try {
    const result =
      await getPayoutHistory({
        partner,
        accessToken,
        limit
      });


    if (destroyed) {
      return {
        root,

        destroy() {}
      };
    }


    const recentPayouts =
      Array.isArray(
        result?.recent_payouts
      )
        ? result.recent_payouts
        : [];


    if (
      recentPayouts.length ===
      0
    ) {
      renderState(
        root,
        {
          title:
            "No payouts yet",

          message:
            "Your payouts will appear here."
        }
      );

      return {
        root,

        destroy() {
          destroyed =
            true;

          clearElement(
            root
          );
        }
      };
    }


    renderPayoutHistory({
      root,

      payouts:
        recentPayouts,

      accessToken,

      buildRepeatUrl,

      onReceiptError:
        showReceiptError
    });
  }
  catch (
    error
  ) {
    if (!destroyed) {
      renderState(
        root,
        {
          title:
            "Could not load history",

          message:
            error?.message ||
            "History could not be loaded.",

          role:
            "alert"
        }
      );
    }
  }


  return {
    root,

    destroy() {
      destroyed =
        true;

      removeReceiptError();

      clearElement(
        root
      );
    }
  };
}
