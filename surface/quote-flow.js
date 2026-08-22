// unibridge-landing/surface/quote-flow.js

import {
  applyAmountLimitUi
} from "./amount-limits.js";

import {
  getRouteSelectedProvider
} from "./funding-context.js";

import {
  createPricingViewModel,
  formatRouteLimitMessage,
  isRouteAmountAvailable,
  renderPricing,
  selectFirstAvailableRoute
} from "/shared/pricing/index.js";


export function createQuoteFlow({
  state,
  elements,
  apiPost,
  getValue,
  emit,
  setStatus,
  resetUiToStart,
  resetStatusMemory,
  resetFlowState,
  setCurrentFundingProvider,
  getCountryLabel,
  getSourceCountryCode,
  getCustomerPaymentCurrency,
  getActiveContinueButton,
  setContinueButtonsDisabled,
  setContinueButtonMode,
  isPhilippinesDestination,
  getCoinsPhPicker
}) {
  const {
    sendBtn,
    continueBtn,
    quoteBox
  } = elements;


  function getCurrentSelectedRoute() {
    return (
      state.currentRouteQuote?.route ||
      null
    );
  }


  function resolveNoAvailableRouteMessage(
    routes = []
  ) {
    if (!Array.isArray(routes)) {
      return null;
    }

    for (const route of routes) {
      const message =
        formatRouteLimitMessage(route);

      if (message) {
        return message;
      }
    }

    return null;
  }


  function assertCurrentRouteAmountAvailable() {
    const route =
      getCurrentSelectedRoute();

    if (!route) {
      throw new Error(
        "selected_route_missing"
      );
    }

    if (!isRouteAmountAvailable(route)) {
      throw new Error(
        formatRouteLimitMessage(route) ||
        "selected_route_amount_not_available"
      );
    }

    return route;
  }


  function isCurrentRouteAmountAvailable() {
    const route =
      getCurrentSelectedRoute();

    return Boolean(
      route &&
      isRouteAmountAvailable(route)
    );
  }


  function resetPricingUi() {
    if (!quoteBox) {
      return;
    }

    quoteBox.replaceChildren();
    quoteBox.classList.add(
      "hidden"
    );
  }


  function resetQuoteState() {
    state.currentRouteQuote =
      null;

    resetPricingUi();

    getCoinsPhPicker()
      ?.reset();
  }


  function renderRoutePricing({
    quote,
    route,
    amount
  } = {}) {
    if (!quoteBox) {
      throw new Error(
        "missing_quote_box"
      );
    }

    const model =
      createPricingViewModel({
        quote,
        route,

        customerPaymentAmount:
          amount,

        customerPaymentCurrency:
          getCustomerPaymentCurrency(),

        sourceLabel:
          getSourceCountryCode(),

        destinationLabel:
          getCountryLabel()
      });

    renderPricing(
      quoteBox,
      model
    );

    quoteBox.classList.remove(
      "hidden"
    );
  }


  function refreshAmountLimitUi() {
    const activeContinueBtn =
      getActiveContinueButton() ||
      continueBtn;

    const result =
      applyAmountLimitUi({
        amountInput:
          getValue("amount"),

        messageEl:
          document.getElementById(
            "amountLimitHint"
          ),

        continueBtn:
          activeContinueBtn,

        provider:
          state.currentFundingProvider,

        country:
          getSourceCountryCode()
      });

    /*
    Before quote, provider may be null.

    amount-limits.js falls back to source-country
    limits so invalid funding amounts can be blocked
    before Route selection.
    */
    if (
      sendBtn &&
      !state.settlementId
    ) {
      sendBtn.disabled =
        !result.ok;
    }

    return result;
  }


  function syncRouteLimitContinueUi() {
    if (
      state.settlementId ||
      state.pendingWidgetUrl
    ) {
      return;
    }

    if (!state.currentRouteQuote) {
      if (
        state.sessionId ||
        state.routeId
      ) {
        setContinueButtonsDisabled(
          true
        );
      }

      return;
    }

    if (
      !isCurrentRouteAmountAvailable()
    ) {
      setContinueButtonsDisabled(
        true
      );
    }
  }


  function refreshLimitUi() {
    const result =
      refreshAmountLimitUi();

    syncRouteLimitContinueUi();

    return result;
  }


  function setAmountInputDisabled(
    disabled
  ) {
    const amountInput =
      getValue("amount");

    if (amountInput) {
      amountInput.disabled =
        Boolean(disabled);
    }
  }


  function resetFlowForRouteInputChange() {
    resetFlowState();
    resetUiToStart();
    resetStatusMemory();
    setStatus("");

    const limitCheck =
      refreshLimitUi();

    if (sendBtn) {
      sendBtn.disabled =
        !limitCheck.ok;
    }

    setContinueButtonsDisabled(
      true
    );
  }


  async function startFlow() {
    if (state.processing) {
      return;
    }

    try {
      /*
      A new quote invalidates the previous funding UI,
      settlement state and provider session through the
      single shared reset boundary.
      */
      resetFlowState();
      resetUiToStart();
      resetStatusMemory();

      state.processing =
        true;

      if (sendBtn) {
        sendBtn.disabled =
          true;
      }

      setContinueButtonsDisabled(
        true
      );

      setStatus(
        "Registering..."
      );

      const amount =
        Number(
          getValue("amount")
            ?.value
        );

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        throw new Error(
          "invalid_amount"
        );
      }

      const limitCheck =
        refreshAmountLimitUi();

      if (
        limitCheck &&
        !limitCheck.ok
      ) {
        throw new Error(
          limitCheck.message
        );
      }

      const reg =
        await apiPost(
          "fiat/session/register",
          {
            source_country:
              getValue(
                "source_country"
              )?.value,

            receiver_country:
              getValue(
                "country"
              )?.value
          }
        );

      state.sessionId =
        reg.session_id;

      await apiPost(
        "session/resolve",
        {
          session_id:
            state.sessionId
        }
      );

      const quote =
        await apiPost(
          "session/quote",
          {
            session_id:
              state.sessionId,

            amount
          }
        );

      if (!quote.routes?.length) {
        throw new Error(
          "no_routes"
        );
      }

      const selectedRoute =
        selectFirstAvailableRoute(
          quote.routes
        );

      if (!selectedRoute) {
        throw new Error(
          resolveNoAvailableRouteMessage(
            quote.routes
          ) ||
          "no_routes_available_for_amount"
        );
      }

      state.routeId =
        selectedRoute.route_id ||
        selectedRoute.id;

      if (!state.routeId) {
        throw new Error(
          "selected_route_missing"
        );
      }

      setCurrentFundingProvider(
        getRouteSelectedProvider(
          selectedRoute
        )
      );

      /*
      Keep the complete backend quote + Route contract.

      The Route remains authoritative for execution-side
      limits and backend-driven ordering.
      */
      state.currentRouteQuote = {
        quote,
        route:
          selectedRoute
      };

      renderRoutePricing({
        quote,
        route:
          selectedRoute,
        amount
      });

      emit(
        "unibridge:quote"
      );

      setContinueButtonMode(
        "prepare_payment"
      );

      refreshLimitUi();

      if (
        isPhilippinesDestination()
      ) {
        const coinsPhPicker =
          getCoinsPhPicker();

        await coinsPhPicker
          ?.load();

        coinsPhPicker
          ?.updateContinueState();

        syncRouteLimitContinueUi();

        setStatus(
          "Select recipient institution."
        );

        return;
      }

      if (continueBtn) {
        continueBtn.disabled =
          !isCurrentRouteAmountAvailable();
      }

      setStatus(
        "Enter PIX key"
      );
    } catch (error) {
      setStatus(
        error,
        "error"
      );

      const limitCheck =
        refreshLimitUi();

      const activeBtn =
        getActiveContinueButton();

      const canContinue =
        Boolean(
          limitCheck?.ok &&
          state.sessionId &&
          state.routeId &&
          isCurrentRouteAmountAvailable()
        );

      if (activeBtn) {
        if (
          canContinue &&
          isPhilippinesDestination()
        ) {
          getCoinsPhPicker()
            ?.updateContinueState();

          syncRouteLimitContinueUi();
        } else {
          activeBtn.disabled =
            !canContinue;
        }
      }
    } finally {
      state.processing =
        false;

      refreshLimitUi();

      if (
        isPhilippinesDestination() &&
        isCurrentRouteAmountAvailable()
      ) {
        getCoinsPhPicker()
          ?.updateContinueState();

        syncRouteLimitContinueUi();
      } else if (
        !state.settlementId &&
        !isCurrentRouteAmountAvailable()
      ) {
        setContinueButtonsDisabled(
          true
        );
      }
    }
  }


  function bindRouteInputEvents() {
    const amountInput =
      getValue("amount");

    const sourceCountryInput =
      getValue("source_country");

    const countryInput =
      getValue("country");


    amountInput
      ?.addEventListener(
        "input",
        () => {
          if (
            state.sessionId ||
            state.routeId ||
            state.settlementId ||
            state.currentRouteQuote
          ) {
            resetFlowForRouteInputChange();
            return;
          }

          refreshLimitUi();
        }
      );


    amountInput
      ?.addEventListener(
        "blur",
        refreshLimitUi
      );


    sourceCountryInput
      ?.addEventListener(
        "change",
        resetFlowForRouteInputChange
      );


    countryInput
      ?.addEventListener(
        "change",
        resetFlowForRouteInputChange
      );
  }


  return {
    startFlow,
    bindRouteInputEvents,

    resetQuoteState,
    refreshAmountLimitUi,
    refreshLimitUi,
    syncRouteLimitContinueUi,
    assertCurrentRouteAmountAvailable,
    isCurrentRouteAmountAvailable,
    setAmountInputDisabled
  };
}
