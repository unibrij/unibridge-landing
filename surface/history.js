// surface/history.js

import {
  getFiatClerkToken
} from "/shared/pay/auth/clerkAuth.js";

import {
  initPayHistory
} from "/partials/pay/js/pay-history.js";


const PARTNER =
  "surface";

let appNode =
  null;

let historyNode =
  null;

let historyRoot =
  null;

let historyLoadPromise =
  null;

let surfaceAppPromise =
  null;


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
    "/surface/?" +
    params.toString()
  );
}


/*
--------------------------------------------------
Navigation state
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

function loadHistory() {
  if (historyLoadPromise) {
    return historyLoadPromise;
  }

  historyLoadPromise =
    (async () => {
      const accessToken =
        await getFiatClerkToken();

      await initPayHistory({
        root:
          historyRoot,

        partner:
          PARTNER,

        accessToken,

        buildRepeatUrl
      });
    })()
      .finally(
        () => {
          historyLoadPromise =
            null;
        }
      );

  return historyLoadPromise;
}


/*
--------------------------------------------------
Surface app
--------------------------------------------------
*/

function loadSurfaceApp() {
  if (surfaceAppPromise) {
    return surfaceAppPromise;
  }

  surfaceAppPromise =
    import(
      "/surface/app.js"
    )
      .then(
        module => {
          return module.initSurface();
        }
      )
      .catch(
        error => {
          surfaceAppPromise =
            null;

          throw error;
        }
      );

  return surfaceAppPromise;
}


/*
--------------------------------------------------
View
--------------------------------------------------
*/

async function renderView() {
  const historyMode =
    isHistoryView();

  const navigation =
    document.querySelector(
      ".pay-navigation"
    );

  if (!navigation) {
    throw new Error(
      "surface_navigation_missing"
    );
  }

  setActiveNavigation(
    historyMode
  );

  if (historyMode) {
    appNode.remove();

    if (
      !historyNode.isConnected
    ) {
      navigation.insertAdjacentElement(
        "afterend",
        historyNode
      );
    }

    await loadHistory();

    return;
  }

  historyNode.remove();

  if (
    !appNode.isConnected
  ) {
    navigation.insertAdjacentElement(
      "afterend",
      appNode
    );
  }

  await loadSurfaceApp();
}


/*
--------------------------------------------------
Client-side navigation
--------------------------------------------------
*/

function navigate(
  url
) {
  const next =
    new URL(
      url,
      window.location.origin
    );

  const target =
    next.pathname +
    next.search;

  const current =
    window.location.pathname +
    window.location.search;

  if (
    target ===
    current
  ) {
    return;
  }

  window.history.pushState(
    {},
    "",
    target
  );

  renderView()
    .catch(
      error => {
        console.error(
          "SURFACE_VIEW_ERROR",
          error
        );
      }
    );
}

function bindNavigation() {
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
    throw new Error(
      "surface_navigation_missing"
    );
  }

  for (
    const link of
      [
        newPayout,
        history
      ]
  ) {
    link.addEventListener(
      "click",
      event => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }

        event.preventDefault();

        navigate(
          link.href
        );
      }
    );
  }

  window.addEventListener(
    "popstate",
    () => {
      renderView()
        .catch(
          error => {
            console.error(
              "SURFACE_VIEW_ERROR",
              error
            );
          }
        );
    }
  );
}


/*
--------------------------------------------------
Lifecycle
--------------------------------------------------
*/

document.addEventListener(
  "pay-partials-ready",
  () => {
    appNode =
      document.getElementById(
        "surfaceApp"
      );

    historyNode =
      document.getElementById(
        "pay-history"
      );

    historyRoot =
      document.getElementById(
        "payHistory"
      );

    if (
      !appNode ||
      !historyNode ||
      !historyRoot
    ) {
      console.error(
        "SURFACE_VIEW_MOUNT_MISSING"
      );

      return;
    }

    try {
      bindNavigation();

      renderView()
        .catch(
          error => {
            console.error(
              "SURFACE_VIEW_ERROR",
              error
            );
          }
        );
    }
    catch (
      error
    ) {
      console.error(
        "SURFACE_HISTORY_INIT_ERROR",
        error
      );
    }
  },
  {
    once:
      true
  }
);
