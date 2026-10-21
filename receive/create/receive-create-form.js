// unibridge-landing/receive/create/receive-create-form.js

import {
  railsForCountry,
  findReceiveRoute,
  formatRailLabel,
  renderReceiveFields,
  collectReceiveBeneficiary,
  cancelReceiveFieldRender
} from "../receive-form.js";

import {
  createReceiveSelect
} from "../receive-select.js";


function normalizeString(value) {
  return String(value ?? "").trim();
}


function normalizeUpper(value) {
  return normalizeString(value).toUpperCase();
}


function setHidden(element, hidden) {
  if (element) {
    element.hidden = Boolean(hidden);
  }
}


export function createReceiveFormController({
  els,
  clearCreateError,
  showCreateError,
  onInvalidatePending
} = {}) {
  let catalog = [];
  let selectedRoute = null;
  let beneficiaryReady = false;
  let fieldRenderVersion = 0;
  let restoring = false;
  let eventsBound = false;

  const railSelect =
    els?.payoutRail
      ? createReceiveSelect({
          select: els.payoutRail,
          placeholder: "Choose receiving method"
        })
      : null;


  function invalidatePending() {
    if (!restoring) {
      onInvalidatePending?.();
    }
  }


  function resetBeneficiary() {
    fieldRenderVersion += 1;

    selectedRoute = null;
    beneficiaryReady = false;

    invalidatePending();

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
      { country, rail }
    );

    if (!selectedRoute) {
      return;
    }

    const route = selectedRoute;
    const renderVersion = ++fieldRenderVersion;

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
    } catch (error) {
      if (renderVersion !== fieldRenderVersion) {
        return;
      }

      beneficiaryReady = false;

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

    if (!country || !els?.payoutRail) {
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
      els?.railSection,
      false
    );

    if (rails.length === 1) {
      els.payoutRail.value = rails[0];
      railSelect?.sync();

      await handleRailChange();
    }
  }


  function collectRequest() {
    if (!selectedRoute) {
      throw new Error(
        "Choose a receiving method."
      );
    }

    if (!beneficiaryReady) {
      throw new Error(
        "Receiving details are still loading."
      );
    }

    const beneficiary =
      collectReceiveBeneficiary(
        els?.beneficiaryFields
      );

    return {
      routeId: selectedRoute.route_id,
      country: normalizeUpper(
        els?.destinationCountry?.value
      ),
      rail: normalizeString(
        els?.payoutRail?.value
      ),
      beneficiary
    };
  }


  async function restore(saved) {
    restoring = true;

    try {
      const country = normalizeUpper(saved.country);
      const rail = normalizeString(saved.rail);

      const route = findReceiveRoute(
        catalog,
        { country, rail }
      );

      if (
        !route ||
        normalizeString(route.route_id) !==
          normalizeString(saved.routeId)
      ) {
        throw new Error(
          "Receiving method changed. Please select it again."
        );
      }

      els.destinationCountry.value = country;

      els.destinationCountry.dispatchEvent(
        new Event("change", { bubbles: true })
      );

      await handleCountryChange();

      if (
        normalizeUpper(
          els.destinationCountry.value
        ) !== country
      ) {
        throw new Error(
          "Unable to restore destination country."
        );
      }

      els.payoutRail.value = rail;
      railSelect?.sync();

      if (
        normalizeString(els.payoutRail.value) !== rail
      ) {
        throw new Error(
          "Receiving method is unavailable."
        );
      }

      if (
        !beneficiaryReady ||
        !selectedRoute ||
        normalizeString(selectedRoute.route_id) !==
          normalizeString(saved.routeId)
      ) {
        await handleRailChange();
      }

      if (
        !beneficiaryReady ||
        !selectedRoute ||
        normalizeString(selectedRoute.route_id) !==
          normalizeString(saved.routeId)
      ) {
        throw new Error(
          "Unable to restore receiving details."
        );
      }

      const controls =
        els.beneficiaryFields?.querySelectorAll(
          "[data-receive-field]"
        ) || [];

      for (const control of controls) {
        const name = normalizeString(
          control.dataset.receiveField
        );

        if (
          !Object.prototype.hasOwnProperty.call(
            saved.beneficiary,
            name
          )
        ) {
          continue;
        }

        control.value = normalizeString(
          saved.beneficiary[name]
        );

        if (control.tagName === "SELECT") {
          control.dispatchEvent(
            new Event("change", { bubbles: true })
          );
        }
      }

      const beneficiary =
        collectReceiveBeneficiary(
          els.beneficiaryFields
        );

      const savedKeys =
        Object.keys(saved.beneficiary);

      if (
        savedKeys.length !==
          Object.keys(beneficiary).length ||
        !savedKeys.every(key =>
          Object.prototype.hasOwnProperty.call(
            beneficiary,
            key
          ) &&
          normalizeString(beneficiary[key]) ===
            normalizeString(saved.beneficiary[key])
        )
      ) {
        throw new Error(
          "Please review your receiving details and try again."
        );
      }

      return {
        country,
        rail,
        routeId: saved.routeId,
        beneficiary
      };
    } finally {
      restoring = false;
    }
  }


  function handleBeneficiaryEdit() {
    clearCreateError?.();

    if (!restoring) {
      onInvalidatePending?.();
    }
  }


  function bindEvents() {
    if (eventsBound) {
      return;
    }

    eventsBound = true;

    els?.destinationCountry?.addEventListener(
      "change",
      () => {
        if (restoring) return;

        handleCountryChange().catch(error => {
          showCreateError?.(
            error?.message ||
            "Unable to update receiving route."
          );
        });
      }
    );

    els?.payoutRail?.addEventListener(
      "change",
      () => {
        if (restoring) return;

        handleRailChange().catch(error => {
          showCreateError?.(
            error?.message ||
            "Unable to load receiving details."
          );
        });
      }
    );

    els?.beneficiaryFields?.addEventListener(
      "input",
      handleBeneficiaryEdit
    );

    els?.beneficiaryFields?.addEventListener(
      "change",
      handleBeneficiaryEdit
    );
  }


  function reset() {
    if (els?.destinationCountry) {
      els.destinationCountry.value = "";
    }

    resetRail();
  }


  function setCatalog(nextCatalog) {
    catalog = Array.isArray(nextCatalog)
      ? nextCatalog
      : [];
  }


  return {
    bindEvents,
    setCatalog,
    handleCountryChange,
    collectRequest,
    restore,
    reset
  };
}
