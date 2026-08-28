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


export function createReceiveCreateFlow({
  els,
  showOnly,
  clearCreateError,
  showCreateError,
  onCreated
} = {}) {
  let catalog = [];
  let selectedRoute = null;
  let fieldRenderVersion = 0;
  let eventsBound = false;


  function resetBeneficiary() {
    fieldRenderVersion += 1;
    selectedRoute = null;

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
    if (els?.payoutRail) {
      els.payoutRail.innerHTML = "";
    }

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
        els?.destinationCountry?.value
      );

    const rail =
      normalizeString(
        els?.payoutRail?.value
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
        selectedRoute !== route
      ) {
        return;
      }

      setHidden(
        els?.beneficiarySection,
        false
      );
    } catch (error) {
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
        els?.destinationCountry?.value
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

    const placeholder =
      document.createElement(
        "option"
      );

    placeholder.value = "";
    placeholder.textContent =
      "Choose receiving method";

    els.payoutRail.appendChild(
      placeholder
    );

    for (const rail of rails) {
      const option =
        document.createElement(
          "option"
        );

      option.value = rail;
      option.textContent =
        formatRailLabel(
          rail
        );

      els.payoutRail.appendChild(
        option
      );
    }

    setHidden(
      els.railSection,
      false
    );

    if (rails.length === 1) {
      els.payoutRail.value =
        rails[0];

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

    let beneficiary;

    try {
      beneficiary =
        collectReceiveBeneficiary(
          els?.beneficiaryFields
        );
    } catch (error) {
      showCreateError?.(
        error?.message
      );

      return;
    }

    if (!els?.createButton) {
      return;
    }

    const originalText =
      els.createButton.textContent;

    els.createButton.disabled = true;
    els.createButton.textContent =
      "Creating…";

    try {
      const result =
        await createReceiveProfile({
          routeId:
            selectedRoute.route_id,
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
    } catch (error) {
      showCreateError?.(
        error?.message ||
        "Unable to create receive link."
      );
    } finally {
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

    els?.createButton
      ?.addEventListener(
        "click",
        handleCreate
      );
  }


  async function init() {
    showOnly?.(
      "receiveCreateView"
    );

    bindEvents();

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
