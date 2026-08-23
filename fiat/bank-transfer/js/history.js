// fiat/bank-transfer/js/history.js

import {
  getFiatClerkToken
} from "/shared/pay/auth/clerkAuth.js";

import {
  initPayHistory
} from "/partials/pay/js/pay-history.js";


const PARTNER =
  "fiat_bank_transfer";


/*
--------------------------------------------------
View
--------------------------------------------------
*/

function isHistoryView() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  return (
    params.get(
      "view"
    ) ===
    "history"
  );
}


/*
--------------------------------------------------
Repeat payout URL
--------------------------------------------------
*/

function buildRepeatUrl({
  params
}) {
  return (
    "/fiat/bank-transfer/?" +
    params.toString()
  );
}


/*
--------------------------------------------------
Navigation
--------------------------------------------------
*/

function setActiveNavigation(
  historyMode
) {
  const newPayout =
    document.getElementById(
      "payNavNewPayout"
    );

  const history =
    document.getElementById(
      "payNavHistory"
    );

  if (
    !newPayout ||
    !history
  ) {
    return;
  }

  newPayout.classList.toggle(
    "is-active",
    !historyMode
  );

  history.classList.toggle(
    "is-active",
    historyMode
  );

  if (historyMode) {
    history.setAttribute(
      "aria-current",
      "page"
    );

    newPayout.removeAttribute(
      "aria-current"
    );

    return;
  }

  newPayout.setAttribute(
    "aria-current",
    "page"
  );

  history.removeAttribute(
    "aria-current"
  );
}


/*
--------------------------------------------------
History
--------------------------------------------------
*/

async function initHistoryView() {
  const historyMode =
    isHistoryView();

  setActiveNavigation(
    historyMode
  );

  if (!historyMode) {
    return;
  }

  const app =
    document.getElementById(
      "bankTransferApp"
    );

  const history =
    document.getElementById(
      "pay-history"
    );

  if (
    !app ||
    !history
  ) {
    throw new Error(
      "bank_transfer_history_mount_missing"
    );
  }

  /*
  History is a separate view.
  The bank-transfer form does not belong
  in the History DOM.
  */

  app.remove();

  /*
  Shared Clerk auth owns the auth lifecycle.
  */

  const accessToken =
    await getFiatClerkToken();

  await initPayHistory({
    partner:
      PARTNER,

    accessToken,

    buildRepeatUrl
  });
}


/*
--------------------------------------------------
Lifecycle
--------------------------------------------------
*/

document.addEventListener(
  "pay-partials-ready",
  () => {
    initHistoryView()
      .catch(
        error => {
          console.error(
            "BANK_TRANSFER_HISTORY_INIT_ERROR",
            error
          );
        }
      );
  },
  {
    once:
      true
  }
);
