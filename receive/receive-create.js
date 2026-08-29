// unibridge-landing/receive/receive-create.js

import {
  loadReceiveCatalog,
  createReceiveProfile
} from "./receive-api.js";

import {
  buildReceiveCatalog,
  railsForCountry,
  findReceiveRoute,
  formatRailLabel,
  renderReceiveFields,
  collectReceiveBeneficiary,
  cancelReceiveFieldRender
} from "./receive-form.js";

import {
  createReceiveSelect
} from "./receive-select.js";


const AUTH_BRIDGE_KEY =
  "__fiatClerkAuth";

const AUTH_EVENT =
  "fiat-clerk-auth-updated";


function normalizeString(value) {
  return String(value ?? "").trim();
}

function normalizeUpper(value) {
  return normalizeString(value).toUpperCase();
}

function setHidden(element, hidden) {
  if (!element) {
    return;
  }

  element.hidden =
    Boolean(hidden);
}

function readAuthBridge() {
  const bridge =
    window[AUTH_BRIDGE_KEY];

  return bridge &&
    typeof bridge === "object"
      ? bridge
      : null;
}

function isSignedIn() {
  const bridge =
    readAuthBridge();

  return Boolean(
    bridge?.isLoaded &&
    bridge?.isSignedIn &&
    normalizeString(
      bridge?.auth_subject_id ||
      bridge?.userId
    )
  );
}


export function createReceiveCreateFlow({
  els,
  showOnly,
  clearCreateError,
  showCreateError,
  onCreated
} = {}) {
  let catalog = [];
  let selectedRoute = null;
  let beneficiaryReady = false;
  let fieldRenderVersion = 0;
  let eventsBound = false;

  const railSelect =
    els?.payoutRail
      ? createReceiveSelect({
          select:
            els.payoutRail,

          placeholder:
            "Choose receiving method"
        })
      : null;


  function syncAuthUi() {
    const signedIn =
      isSignedIn();

    setHidden(
      els?.authSection,
      signedIn
    );

    return signedIn;
  }


  function resetBeneficiary() {
    fieldRenderVersion += 1;
    selectedRoute = null;
    beneficiaryReady = false;

    cancelReceiveFieldRender(
      els?.beneficiaryFields
    );

    if (els?.beneficiaryFields) {
      els.beneficiaryFields.innerHTML =
        "";
    }

    setHidden(
      els?.beneficiarySection,
      true
    );
  }


  function resetRail() {
    railSelect?.setOptions(
      []
    );

    setHidden(
      els?.railSection,
      true
    );

    resetBeneficiary();
  }


  async function handleRailChange() {
    clearCreateError?.();
    resetBeneficiary();

    const country =
      normalizeUpper(
        els?.destinationCountry
          ?.value
      );

    const rail =
      normalizeString(
        els?.payoutRail
          ?.value
      );

    selectedRoute =
      findReceiveRoute(
        catalog,
        {
          country,
          rail
        }
      );

    if (!selectedRoute) {
      return;
    }

    const route =
      selectedRoute;

    beneficiaryReady = false;

    const renderVersion =
      ++fieldRenderVersion;

    try {
      await renderReceiveFields({
        root:
          els?.beneficiaryFields,

        route
      });

      if (
        renderVersion !==
          fieldRenderVersion ||
        selectedRoute !==
          route
      ) {
        return;
      }

      beneficiaryReady = true;

      setHidden(
        els?.beneficiarySection,
        false
      );
    }
    catch (error) {
      beneficiaryReady = false;

      if (
        renderVersion !==
        fieldRenderVersion
      ) {
        return;
      }

      showCreateError?.(
        error?.message ||
        "Unable to load receiving details."
      );
    }
  }


  async function handleCountryChange() {
    clearCreateError?.();
    resetRail();

    const country =
      normalizeUpper(
        els?.destinationCountry
          ?.value
      );

    if (
      !country ||
      !els?.payoutRail
    ) {
      return;
    }

    const rails =
      railsForCountry(
        catalog,
        country
      );

    if (!rails.length) {
      return;
    }

    railSelect?.setOptions(
      rails.map(
        rail => ({
          value:
            rail,

          label:
            formatRailLabel(
              rail
            )
        })
      )
    );

    setHidden(
      els.railSection,
      false
    );

    if (rails.length === 1) {
      els.payoutRail.value =
        rails[0];

      railSelect?.sync();

      await handleRailChange();
    }
  }


  async function handleCreate() {
    clearCreateError?.();

    if (!selectedRoute) {
      showCreateError?.(
        "Choose a receiving method."
      );

      return;
    }

    if (!beneficiaryReady) {
      showCreateError?.(
        "Receiving details are still loading."
      );

      return;
    }

    let beneficiary;

    try {
      beneficiary =
        collectReceiveBeneficiary(
          els?.beneficiaryFields
        );
    }
    catch (error) {
      showCreateError?.(
        error?.message
      );

      return;
    }

    if (!syncAuthUi()) {
      return;
    }

    if (!els?.createButton) {
      return;
    }

    const originalText =
      els.createButton
        .textContent;

    els.createButton.disabled =
      true;

    els.createButton.textContent =
      "Creating…";

    try {
      const result =
        await createReceiveProfile({
          routeId:
            selectedRoute
              .route_id,

          beneficiary
        });

      if (
        typeof onCreated ===
        "function"
      ) {
        await onCreated(
          result
        );
      }
    }
    catch (error) {
      showCreateError?.(
        error?.message ||
        "Unable to create receive link."
      );
    }
    finally {
      els.createButton.disabled =
        false;

      els.createButton.textContent =
        originalText;
    }
  }


  function reset() {
    clearCreateError?.();

    if (els?.destinationCountry) {
      els.destinationCountry.value =
        "";
    }

    resetRail();
    syncAuthUi();

    showOnly?.(
      "receiveCreateView"
    );
  }


  function bindEvents() {
    if (eventsBound) {
      return;
    }

    eventsBound =
      true;

    els?.destinationCountry
      ?.addEventListener(
        "change",
        () => {
          handleCountryChange()
            .catch(error => {
              showCreateError?.(
                error?.message ||
                "Unable to update receiving route."
              );
            });
        }
      );

    els?.payoutRail
      ?.addEventListener(
        "change",
        () => {
          handleRailChange()
            .catch(error => {
              showCreateError?.(
                error?.message ||
                "Unable to load receiving details."
              );
            });
        }
      );

    els?.beneficiaryFields
      ?.addEventListener(
        "input",
        () => {
          clearCreateError?.();
        }
      );

    els?.beneficiaryFields
      ?.addEventListener(
        "change",
        () => {
          clearCreateError?.();
        }
      );

    els?.createButton
      ?.addEventListener(
        "click",
        handleCreate
      );

    window.addEventListener(
      AUTH_EVENT,
      syncAuthUi
    );
  }


  async function init() {
    showOnly?.(
      "receiveCreateView"
    );

    bindEvents();
    syncAuthUi();

    const payload =
      await loadReceiveCatalog();

    catalog =
      buildReceiveCatalog(
        payload
      );

    if (!catalog.length) {
      throw new Error(
        "No receive routes are currently available."
      );
    }

    await handleCountryChange();
  }


  return {
    init,
    reset
  };
}
