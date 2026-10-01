// unibridge-landing/receive/receive-rate.js

import {
  previewReceivePricing
} from "./receive-api.js";

import {
  createReceiveSelect
} from "./receive-select.js";

import {
  createPricingViewModel,
  formatRouteLimitMessage,
  renderPricing,
  selectFirstAvailableRoute
} from "/shared/pricing/index.js";


function normalizeString(value) {
  return String(
    value ??
    ""
  ).trim();
}


function normalizeUpper(value) {
  return normalizeString(
    value
  ).toUpperCase();
}


function setHidden(
  element,
  hidden
) {
  if (!element) {
    return;
  }

  element.hidden =
    Boolean(hidden);
}


function getSourceMarkets() {
  const markets =
    globalThis
      ?.UNIBRIDGE_COUNTRY_OPTIONS
      ?.source;

  if (!Array.isArray(markets)) {
    return [];
  }

  return markets
    .map(
      market => ({
        value:
          normalizeUpper(
            market?.value
          ),

        label:
          normalizeString(
            market?.label
          ),

        flag:
          normalizeString(
            market?.flag
          ),

        currency:
          normalizeUpper(
            market?.currency
          )
      })
    )
    .filter(
      market =>
        market.value &&
        market.label
    );
}


function getSourceMarket(
  sourceCountry
) {
  const normalized =
    normalizeUpper(
      sourceCountry
    );

  if (!normalized) {
    return null;
  }

  return (
    getSourceMarkets()
      .find(
        market =>
          market.value ===
          normalized
      ) ||
    null
  );
}


function getSourceCurrency(
  sourceCountry
) {
  return normalizeUpper(
    getSourceMarket(
      sourceCountry
    )?.currency
  );
}


function getSourceLabel(
  sourceCountry
) {
  const market =
    getSourceMarket(
      sourceCountry
    );

  return (
    normalizeString(
      market?.label
    ) ||
    normalizeUpper(
      sourceCountry
    )
  );
}


function buildSourceOptions() {
  return getSourceMarkets()
    .map(
      market => ({
        value:
          market.value,

        label:
          [
            market.flag,
            market.label
          ]
            .filter(Boolean)
            .join(" ")
      })
    );
}


function getDestinationLabel(
  country
) {
  const normalized =
    normalizeUpper(
      country
    );

  if (!normalized) {
    return "";
  }

  try {
    if (
      typeof Intl.DisplayNames ===
        "function"
    ) {
      const names =
        new Intl.DisplayNames(
          ["en"],
          {
            type:
              "region"
          }
        );

      return (
        names.of(
          normalized
        ) ||
        normalized
      );
    }
  }
  catch {
    // Fall back to the country code.
  }

  return normalized;
}


function resolveNoAvailableRouteMessage(
  routes
) {
  if (!Array.isArray(routes)) {
    return null;
  }

  for (const route of routes) {
    const message =
      formatRouteLimitMessage(
        route
      );

    if (message) {
      return message;
    }
  }

  return null;
}


export function createReceiveRateFlow({
  els
} = {}) {
  let receiveProfileId =
    null;

  let eventsBound =
    false;

  let requestVersion =
    0;

  let loading =
    false;


  const rateSourceSelect =
    els?.rateSourceCountry
      ? createReceiveSelect({
          select:
            els.rateSourceCountry,

          placeholder:
            "Choose a country",

          options:
            buildSourceOptions(),

          searchable:
            false
        })
      : null;


  function clearMessage() {
    if (!els?.rateMessage) {
      return;
    }

    els.rateMessage.textContent =
      "";

    setHidden(
      els.rateMessage,
      true
    );
  }


  function showMessage(message) {
    if (!els?.rateMessage) {
      return;
    }

    els.rateMessage.textContent =
      normalizeString(
        message
      ) ||
      "Unable to check today's rate.";

    setHidden(
      els.rateMessage,
      false
    );
  }


  function clearPricing() {
    if (!els?.ratePricing) {
      return;
    }

    els.ratePricing.replaceChildren();

    setHidden(
      els.ratePricing,
      true
    );
  }


  function setLoading(value) {
    loading =
      Boolean(value);

    if (!els?.rateCheckButton) {
      return;
    }

    els.rateCheckButton.disabled =
      loading;

    els.rateCheckButton.textContent =
      loading
        ? "Checking…"
        : "Check rate";
  }


  function syncSourceOptions() {
    rateSourceSelect
      ?.setOptions(
        buildSourceOptions()
      );
  }


  function syncCurrency() {
    if (!els?.rateCurrency) {
      return;
    }

    els.rateCurrency.textContent =
      getSourceCurrency(
        els
          ?.rateSourceCountry
          ?.value
      );
  }


  function open() {
    if (!receiveProfileId) {
      return;
    }

    clearMessage();
    clearPricing();
    setLoading(false);

    syncSourceOptions();
    syncCurrency();

    setHidden(
      els?.rateSheet,
      false
    );

    document.body.classList.add(
      "receive-rate-open"
    );

    window.requestAnimationFrame(
      () => {
        if (
          !els
            ?.rateSourceCountry
            ?.value
        ) {
          rateSourceSelect
            ?.focus();

          return;
        }

        els?.rateAmount
          ?.focus();
      }
    );
  }


  function close() {
    /*
    Invalidate any in-flight preview.

    The request may still resolve, but its result
    must no longer mutate this UI.
    */

    requestVersion +=
      1;

    setLoading(false);

    setHidden(
      els?.rateSheet,
      true
    );

    document.body.classList.remove(
      "receive-rate-open"
    );
  }


  function renderResult({
    payload,
    route,
    amount
  }) {
    if (!els?.ratePricing) {
      return;
    }

    const sourceCountry =
      normalizeUpper(
        payload?.source_country ??
        els
          ?.rateSourceCountry
          ?.value
      );

    const sourceCurrency =
      getSourceCurrency(
        sourceCountry
      );

    const sourceLabel =
      getSourceLabel(
        sourceCountry
      );

    const destinationLabel =
      getDestinationLabel(
        payload?.receiver_country
      );

    const model =
      createPricingViewModel({
        quote:
          payload,

        route,

        customerPaymentAmount:
          amount,

        customerPaymentCurrency:
          sourceCurrency,

        sourceLabel,

        destinationLabel
      });

    renderPricing(
      els.ratePricing,
      model
    );

    setHidden(
      els.ratePricing,
      false
    );
  }


  async function checkRate() {
    if (loading) {
      return;
    }

    clearMessage();
    clearPricing();

    if (!receiveProfileId) {
      showMessage(
        "Receive profile missing."
      );

      return;
    }

    const sourceCountry =
      normalizeUpper(
        els
          ?.rateSourceCountry
          ?.value
      );

    const amount =
      normalizeString(
        els
          ?.rateAmount
          ?.value
      );

    if (!sourceCountry) {
      showMessage(
        "Choose where the sender is paying from."
      );

      rateSourceSelect
        ?.focus();

      return;
    }

    if (
      !amount ||
      !Number.isFinite(
        Number(amount)
      ) ||
      Number(amount) <= 0
    ) {
      showMessage(
        "Enter a valid amount."
      );

      els?.rateAmount
        ?.focus();

      return;
    }

    const version =
      ++requestVersion;

    setLoading(true);

    try {
      const payload =
        await previewReceivePricing({
          receiveProfileId,
          sourceCountry,
          amount
        });

      if (
        version !==
        requestVersion
      ) {
        return;
      }

      const routes =
        Array.isArray(
          payload?.routes
        )
          ? payload.routes
          : [];

      const route =
        selectFirstAvailableRoute(
          routes
        );

      if (!route) {
        throw new Error(
          resolveNoAvailableRouteMessage(
            routes
          ) ||
          "No route is available for this amount."
        );
      }

      renderResult({
        payload,
        route,
        amount
      });
    }
    catch (error) {
      if (
        version !==
        requestVersion
      ) {
        return;
      }

      showMessage(
        error?.message ||
        "Unable to check today's rate."
      );
    }
    finally {
      if (
        version ===
        requestVersion
      ) {
        setLoading(false);
      }
    }
  }


  function reset() {
    receiveProfileId =
      null;

    requestVersion +=
      1;

    setLoading(false);

    if (els?.rateAmount) {
      els.rateAmount.value =
        "";
    }

    if (els?.rateSourceCountry) {
      els.rateSourceCountry.value =
        "";
    }

    syncSourceOptions();
    syncCurrency();

    clearMessage();
    clearPricing();

    setHidden(
      els?.rateSheet,
      true
    );

    document.body.classList.remove(
      "receive-rate-open"
    );

    setHidden(
      els?.rateOpenButton,
      true
    );
  }


  function setReceiveProfileId(value) {
    receiveProfileId =
      normalizeString(
        value
      ) ||
      null;

    requestVersion +=
      1;

    setLoading(false);
    clearMessage();
    clearPricing();

    syncSourceOptions();
    syncCurrency();

    setHidden(
      els?.rateOpenButton,
      !receiveProfileId
    );
  }


  function bind() {
    if (eventsBound) {
      return;
    }

    eventsBound =
      true;

    els?.rateOpenButton
      ?.addEventListener(
        "click",
        open
      );

    els?.rateCloseButton
      ?.addEventListener(
        "click",
        close
      );

    els?.rateBackdrop
      ?.addEventListener(
        "click",
        close
      );

    els?.rateSourceCountry
      ?.addEventListener(
        "change",
        () => {
          syncCurrency();
          clearMessage();
          clearPricing();
        }
      );

    els?.rateAmount
      ?.addEventListener(
        "input",
        () => {
          clearMessage();
          clearPricing();
        }
      );

    els?.rateAmount
      ?.addEventListener(
        "keydown",
        event => {
          if (
            event.key ===
            "Enter"
          ) {
            event.preventDefault();

            checkRate();
          }
        }
      );

    els?.rateCheckButton
      ?.addEventListener(
        "click",
        checkRate
      );

    document.addEventListener(
      "keydown",
      event => {
        if (
          event.key ===
            "Escape" &&
          !els
            ?.rateSheet
            ?.hidden
        ) {
          close();
        }
      }
    );

    setLoading(false);

    syncSourceOptions();
    syncCurrency();

    setHidden(
      els?.rateOpenButton,
      !receiveProfileId
    );
  }


  return {
    bind,
    reset,
    setReceiveProfileId
  };
}
