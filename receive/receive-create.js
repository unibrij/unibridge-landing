
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

  element.hidden = Boolean(hidden);
}

function readAuthBridge() {
  const bridge = window[AUTH_BRIDGE_KEY];

  return bridge &&
    typeof bridge === "object"
      ? bridge
      : null;
}

function isSignedIn() {
  const bridge = readAuthBridge();

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

  let authRequested = false;
  let pendingCreate = null;
  let creating = false;
  let createVersion = 0;

  const railSelect =
    els?.payoutRail
      ? createReceiveSelect({
          select: els.payoutRail,
          placeholder: "Choose receiving method"
        })
      : null;


  function syncAuthUi() {
    const signedIn = isSignedIn();

    setHidden(
      els?.authSection,
      signedIn || !authRequested
    );

    return signedIn;
  }


  function revealAuth() {
    authRequested = true;

    syncAuthUi();

    if (!isSignedIn()) {
      els?.authSection
        ?.scrollIntoView?.({
          behavior: "smooth",
          block: "center"
        });
    }
  }


  function invalidatePendingCreate({
    hideAuth = false
  } = {}) {
    createVersion += 1;
    pendingCreate = null;

    if (hideAuth) {
      authRequested = false;
    }

    syncAuthUi();
  }


  function resetBeneficiary() {
    fieldRenderVersion += 1;

    selectedRoute = null;
    beneficiaryReady = false;

    // Changing route invalidates the previous
    // request without interrupting Clerk login.
    invalidatePendingCreate();

    cancelReceiveFieldRender(
      els?.beneficiaryFields
    );

    if (els?.beneficiaryFields) {
      els.beneficiaryFields.innerHTML = "";
    }

    setHidden(
      els?.beneficiarySection,
      true
    );
  }


  function resetRail() {
    railSelect?.setOptions([]);

    setHidden(
      els?.railSection,
      true
    );

    resetBeneficiary();
  }


  async function handleRailChange() {
    clearCreateError?.();
    resetBeneficiary();

    const country = normalizeUpper(
      els?.destinationCountry?.value
    );

    const rail = normalizeString(
      els?.payoutRail?.value
    );

    selectedRoute = findReceiveRoute(
      catalog,
      {
        country,
        rail
      }
    );

    if (!selectedRoute) {
      return;
    }

    const route = selectedRoute;

    beneficiaryReady = false;

    const renderVersion =
      ++fieldRenderVersion;

    try {
      await renderReceiveFields({
        root: els?.beneficiaryFields,
        route
      });

      if (
        renderVersion !== fieldRenderVersion ||
        selectedRoute !== route
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
        renderVersion !== fieldRenderVersion
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

    const country = normalizeUpper(
      els?.destinationCountry?.value
    );

    if (
      !country ||
      !els?.payoutRail
    ) {
      return;
    }

    const rails = railsForCountry(
      catalog,
      country
    );

    if (!rails.length) {
      return;
    }

    railSelect?.setOptions(
      rails.map(rail => ({
        value: rail,
        label: formatRailLabel(rail)
      }))
    );

    setHidden(
      els.railSection,
      false
    );

    if (rails.length === 1) {
      els.payoutRail.value = rails[0];

      railSelect?.sync();

      await handleRailChange();
    }
  }


  async function submitCreate(request) {
    if (
      creating ||
      !request ||
      !isSignedIn()
    ) {
      return;
    }

    if (
      request.version !== createVersion
    ) {
      return;
    }

    if (!els?.createButton) {
      return;
    }

    creating = true;
    pendingCreate = null;

    const originalText =
      els.createButton.textContent;

    els.createButton.disabled = true;
    els.createButton.textContent = "Creating…";

    try {
      const result =
        await createReceiveProfile({
          routeId: request.routeId,
          beneficiary: request.beneficiary
        });

      authRequested = false;
      syncAuthUi();

      if (
        typeof onCreated === "function"
      ) {
        await onCreated(result);
      }
    }
    catch (error) {
      showCreateError?.(
        error?.message ||
        "Unable to create receive link."
      );
    }
    finally {
      creating = false;

      els.createButton.disabled = false;
      els.createButton.textContent =
        originalText;
    }
  }


  async function handleCreate() {
    if (creating) {
      return;
    }

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
      beneficiary = collectReceiveBeneficiary(
        els?.beneficiaryFields
      );
    }
    catch (error) {
      showCreateError?.(
        error?.message ||
        "Enter valid receiving details."
      );

      return;
    }

    const request = {
      routeId: selectedRoute.route_id,
      beneficiary,
      version: ++createVersion
    };

    if (!isSignedIn()) {
      pendingCreate = request;

      revealAuth();

      return;
    }

    pendingCreate = null;

    await submitCreate(request);
  }


  function handleAuthUpdated() {
    const signedIn = syncAuthUi();

    if (
      !signedIn ||
      !pendingCreate ||
      creating
    ) {
      return;
    }

    const request = pendingCreate;

    submitCreate(request).catch(error => {
      showCreateError?.(
        error?.message ||
        "Unable to create receive link."
      );
    });
  }


  function handleBeneficiaryEdit() {
    clearCreateError?.();

    if (!pendingCreate) {
      return;
    }

    // Cancel automatic creation using
    // previously entered payout details.
    //
    // Do not hide or reset Clerk.
    // Let authentication finish normally.
    //
    // Once signed in, the user can click
    // Create my UB Code again.
    invalidatePendingCreate();
  }


  function reset() {
    clearCreateError?.();

    invalidatePendingCreate({
      hideAuth: true
    });

    if (els?.destinationCountry) {
      els.destinationCountry.value = "";
    }

    resetRail();

    showOnly?.(
      "receiveCreateView"
    );
  }


  function bindEvents() {
    if (eventsBound) {
      return;
    }

    eventsBound = true;

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
        handleBeneficiaryEdit
      );

    els?.beneficiaryFields
      ?.addEventListener(
        "change",
        handleBeneficiaryEdit
      );

    els?.createButton
      ?.addEventListener(
        "click",
        handleCreate
      );

    window.addEventListener(
      AUTH_EVENT,
      handleAuthUpdated
    );
  }


  async function init() {
    showOnly?.(
      "receiveCreateView"
    );

    authRequested = false;
    pendingCreate = null;

    bindEvents();
    syncAuthUi();

    const payload =
      await loadReceiveCatalog();

    catalog = buildReceiveCatalog(
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
