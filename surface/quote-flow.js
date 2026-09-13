// unibridge-landing/surface/quote-flow.js

import {
  applyAmountLimitUi
} from "./amount-limits.js";

import {
  getRouteSelectedProvider
} from "./funding-context.js";

import {
  createQuoteDestination
} from "./quote-destination.js";

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
  renderDestinationRoute,
  clearDestinationRoute,
  syncGenericDestinationContinueState,
  getCoinsPhPicker,
  receiveBound = false,
  buildSessionDestinationInput
}) {
  const {
    sendBtn,
    continueBtn,
    quoteBox
  } = elements;

  let flowGeneration =
    0;

  /*
  --------------------------------------------------
  Route-limit presentation state

  Backend pricing remains authoritative.

  Surface funding / ramp limits retain first priority.
  When those limits are valid but every quoted Route
  is rejected by execution limits, the Route message
  is rendered through the same Amount hint.
  --------------------------------------------------
  */

  let routeLimitMessage =
    null;


  function isFlowCurrent(
    generation
  ) {
    return (
      generation ===
      flowGeneration
    );
  }


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

    for (
      const route of
        routes
    ) {
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


  function assertCurrentRouteAmountAvailable() {
    const route =
      getCurrentSelectedRoute();

    if (!route) {
      throw new Error(
        "selected_route_missing"
      );
    }

    if (
      !isRouteAmountAvailable(
        route
      )
    ) {
      throw new Error(
        formatRouteLimitMessage(
          route
        ) ||
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
      isRouteAmountAvailable(
        route
      )
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
    /*
    Any reset invalidates an in-flight quote flow.

    Old async responses may still resolve, but they
    must no longer mutate canonical state or UI.
    */

    flowGeneration +=
      1;

    routeLimitMessage =
      null;

    state.currentRouteQuote =
      null;

    resetPricingUi();

    clearDestinationRoute?.();

    getCoinsPhPicker?.()
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

    const amountInput =
      getValue(
        "amount"
      );

    const messageEl =
      document.getElementById(
        "amountLimitHint"
      );

    /*
    --------------------------------------------------
    Surface funding / ramp limit

    This remains Surface-specific and keeps first
    priority over execution Route-limit messaging.
    --------------------------------------------------
    */

    const result =
      applyAmountLimitUi({
        amountInput,

        messageEl,

        continueBtn:
          activeContinueBtn,

        provider:
          state.currentFundingProvider,

        country:
          getSourceCountryCode()
      });

    /*
    --------------------------------------------------
    Execution Route limit

    Only override the Amount hint when the Surface
    funding limit itself is valid.
    --------------------------------------------------
    */

    if (
      result.ok &&
      routeLimitMessage
    ) {
      if (amountInput) {
        amountInput.style.borderColor =
          "#dc2626";

        amountInput.style.outlineColor =
          "#dc2626";
      }

      if (messageEl) {
        messageEl.innerText =
          routeLimitMessage;

        messageEl.style.display =
          "block";

        messageEl.style.color =
          "#dc2626";
      }

      if (activeContinueBtn) {
        activeContinueBtn.disabled =
          true;
      }

      if (
        sendBtn &&
        !state.settlementId
      ) {
        sendBtn.disabled =
          true;
      }

      return {
        ...result,

        ok:
          false,

        reason:
          "route_amount_unavailable",

        message:
          routeLimitMessage
      };
    }

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

    if (
      !state.currentRouteQuote
    ) {
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


  const quoteDestination =
    createQuoteDestination({
      receiveBound,
      isPhilippinesDestination,
      renderDestinationRoute,
      clearDestinationRoute,
      syncGenericDestinationContinueState,
      syncRouteLimitContinueUi,
      getCoinsPhPicker,
      emit,
      setStatus
    });


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
      getValue(
        "amount"
      );

    if (amountInput) {
      amountInput.disabled =
        Boolean(
          disabled
        );
    }
  }


  function resetFlowForRouteInputChange() {
    routeLimitMessage =
      null;

    resetFlowState();

    resetUiToStart();

    resetStatusMemory();

    setStatus(
      ""
    );

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
    if (
      state.processing
    ) {
      return;
    }

    let generation =
      null;

    let destinationReady =
      false;

    try {
      /*
      A new quote invalidates the previous funding UI,
      settlement state and provider session through the
      single shared reset boundary.
      */

      resetFlowState();

      resetUiToStart();

      resetStatusMemory();

      routeLimitMessage =
        null;


      /*
      Start a new canonical quote generation only after
      the reset boundary has completed.
      */

      generation =
        ++flowGeneration;


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
          getValue(
            "amount"
          )?.value
        );

      if (
        !Number.isFinite(
          amount
        ) ||
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


      if (
        typeof buildSessionDestinationInput !==
        "function"
      ) {
        throw new Error(
          "session_destination_builder_missing"
        );
      }


      const destinationInput =
        buildSessionDestinationInput({
          receiver_country:
            getValue(
              "country"
            )?.value
        });


      const reg =
        await apiPost(
          "fiat/session/register",
          {
            source_country:
              getValue(
                "source_country"
              )?.value,

            ...destinationInput
          }
        );


      if (
        !isFlowCurrent(
          generation
        )
      ) {
        return;
      }


      state.sessionId =
        reg.session_id;


      await apiPost(
        "session/resolve",
        {
          session_id:
            state.sessionId
        }
      );


      if (
        !isFlowCurrent(
          generation
        )
      ) {
        return;
      }


      const quote =
        await apiPost(
          "session/quote",
          {
            session_id:
              state.sessionId,

            amount
          }
        );


      if (
        !isFlowCurrent(
          generation
        )
      ) {
        return;
      }


      if (
        !quote.routes?.length
      ) {
        throw new Error(
          "no_routes"
        );
      }


      const selectedRoute =
        selectFirstAvailableRoute(
          quote.routes
        );


      if (!selectedRoute) {
        routeLimitMessage =
          resolveNoAvailableRouteMessage(
            quote.routes
          );

        throw new Error(
          routeLimitMessage ||
          "no_routes_available_for_amount"
        );
      }


      routeLimitMessage =
        null;


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


      setContinueButtonMode(
        "prepare_payment"
      );


      refreshLimitUi();


      /*
      ------------------------------------------------
      Destination preparation

      Receive / Philippines / generic destination
      behavior is owned by quote-destination.js.
      ------------------------------------------------
      */

      const destinationResult =
        await quoteDestination
          .prepareDestination({
            route:
              selectedRoute,

            generation,

            isFlowCurrent
          });


      if (
        destinationResult
          ?.stale
      ) {
        return;
      }


      destinationReady =
        Boolean(
          destinationResult
            ?.ready
        );
    }
    catch (
      error
    ) {
      /*
      An invalidated flow owns neither state nor UI.
      Ignore its late failure completely.
      */

      if (
        generation !==
          null &&
        !isFlowCurrent(
          generation
        )
      ) {
        return;
      }


      /*
      Route-limit failures are rendered directly under
      Amount.

      Other failures continue through the general
      Surface status channel.
      */

      if (routeLimitMessage) {
        setStatus(
          ""
        );
      } else {
        setStatus(
          error,
          "error"
        );
      }


      const limitCheck =
        refreshLimitUi();

      const activeBtn =
        getActiveContinueButton();


      const canContinue =
        Boolean(
          destinationReady &&
          limitCheck?.ok &&
          state.sessionId &&
          state.routeId &&
          isCurrentRouteAmountAvailable()
        );


      const synced =
        quoteDestination
          .syncAfterError({
            canContinue
          });


      if (
        activeBtn &&
        !synced
      ) {
        activeBtn.disabled =
          true;
      }
    }
    finally {
      /*
      A stale flow must not clear processing or alter
      controls owned by a newer flow.
      */

      if (
        generation !==
          null &&
        !isFlowCurrent(
          generation
        )
      ) {
        return;
      }


      state.processing =
        false;

      refreshLimitUi();


      const synced =
        quoteDestination
          .syncAfterFlow({
            destinationReady,

            routeAmountAvailable:
              isCurrentRouteAmountAvailable()
          });


      if (
        !synced &&
        !state.settlementId
      ) {
        setContinueButtonsDisabled(
          true
        );
      }
    }
  }


  function bindRouteInputEvents() {
    const amountInput =
      getValue(
        "amount"
      );

    const sourceCountryInput =
      getValue(
        "source_country"
      );

    const countryInput =
      getValue(
        "country"
      );


    amountInput
      ?.addEventListener(
        "input",
        () => {
          /*
          The execution-limit result belongs to the
          previous quoted amount.

          Editing Amount invalidates that presentation
          state immediately.
          */

          routeLimitMessage =
            null;

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


    /*
    In Receive mode destination country is bound to
    the Receive snapshot, not to the Surface selector.
    */

    if (!receiveBound) {
      countryInput
        ?.addEventListener(
          "change",
          resetFlowForRouteInputChange
        );
    }
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
