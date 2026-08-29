// unibridge-landing/surface/quote-destination.js

export function createQuoteDestination({
  receiveBound = false,
  isPhilippinesDestination,
  renderDestinationRoute,
  clearDestinationRoute,
  syncGenericDestinationContinueState,
  syncRouteLimitContinueUi,
  getCoinsPhPicker,
  emit,
  setStatus
} = {}) {
  function usesCoinsPhDestinationPicker() {
    return (
      !receiveBound &&
      Boolean(
        isPhilippinesDestination?.()
      )
    );
  }


  async function prepareDestination({
    route,
    generation,
    isFlowCurrent
  } = {}) {
    /*
    --------------------------------------------------
    Receive-bound destination

    Beneficiary data is already bound to the
    Receive Profile and remains backend-authoritative.
    --------------------------------------------------
    */

    if (receiveBound) {
      clearDestinationRoute?.();

      syncGenericDestinationContinueState?.();
      syncRouteLimitContinueUi?.();

      emit?.(
        "unibridge:quote"
      );

      setStatus?.(
        "Ready to prepare payment."
      );

      return {
        ready: true
      };
    }


    /*
    --------------------------------------------------
    Philippines destination

    Normal PH flow still uses the dedicated
    Coins.ph institution picker.
    --------------------------------------------------
    */

    if (
      usesCoinsPhDestinationPicker()
    ) {
      clearDestinationRoute?.();

      const coinsPhPicker =
        getCoinsPhPicker?.();

      await coinsPhPicker
        ?.load();


      if (
        typeof isFlowCurrent ===
          "function" &&
        !isFlowCurrent(
          generation
        )
      ) {
        return {
          ready: false,
          stale: true
        };
      }


      coinsPhPicker
        ?.updateContinueState();

      syncRouteLimitContinueUi?.();

      emit?.(
        "unibridge:quote"
      );

      setStatus?.(
        "Select recipient institution."
      );

      return {
        ready: true
      };
    }


    /*
    --------------------------------------------------
    Generic destination
    --------------------------------------------------
    */

    if (
      typeof renderDestinationRoute !==
        "function"
    ) {
      throw new Error(
        "destination_renderer_missing"
      );
    }


    const rendered =
      await renderDestinationRoute(
        route
      );


    if (
      typeof isFlowCurrent ===
        "function" &&
      !isFlowCurrent(
        generation
      )
    ) {
      return {
        ready: false,
        stale: true
      };
    }


    if (!rendered) {
      throw new Error(
        "destination_schema_missing"
      );
    }


    syncGenericDestinationContinueState?.();
    syncRouteLimitContinueUi?.();

    emit?.(
      "unibridge:quote"
    );

    setStatus?.(
      "Enter destination details."
    );

    return {
      ready: true
    };
  }


  function syncAfterError({
    canContinue
  } = {}) {
    if (!canContinue) {
      return false;
    }

    if (
      usesCoinsPhDestinationPicker()
    ) {
      getCoinsPhPicker?.()
        ?.updateContinueState();

      syncRouteLimitContinueUi?.();

      return true;
    }

    syncGenericDestinationContinueState?.();
    syncRouteLimitContinueUi?.();

    return true;
  }


  function syncAfterFlow({
    destinationReady,
    routeAmountAvailable
  } = {}) {
    if (
      !destinationReady ||
      !routeAmountAvailable
    ) {
      return false;
    }

    if (
      usesCoinsPhDestinationPicker()
    ) {
      getCoinsPhPicker?.()
        ?.updateContinueState();

      syncRouteLimitContinueUi?.();

      return true;
    }

    syncGenericDestinationContinueState?.();
    syncRouteLimitContinueUi?.();

    return true;
  }


  return {
    prepareDestination,
    syncAfterError,
    syncAfterFlow,
    usesCoinsPhDestinationPicker
  };
}
