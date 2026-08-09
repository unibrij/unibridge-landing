// connect-app/src/hooks/useRouteFlow.js

import {
  useEffect,
  useRef,
  useState
} from "react";

import usePayoutAuthorization
  from "./usePayoutAuthorization";

import useSettlementPolling
  from "./useSettlementPolling";

import useFundingTransaction
  from "./useFundingTransaction";

import usePayoutIntentFlow
  from "./usePayoutIntentFlow";

export function useRouteFlow({
  isConnected,
  address,
  chainId,
  walletClient,
  switchChainAsync,

  connectSessionId,
  selectedRoute,
  form,
  pricingPreview,

  payoutIntentId,
  setPayoutIntentId,
  settlement,
  setSettlement,
  setFundingTxHash,
  setIsBusy,

  isReturnedFlow,

  repeatSourcePayoutIntentId,
  repeatAccessToken,

  writeDebug
}) {
  const [
    walletConfirmationPending,
    setWalletConfirmationPending
  ] = useState(
    false
  );

  const payoutIntentIdRef =
    useRef(
      payoutIntentId ||
      null
    );

  /*
   * Identifies the currently attached pre-funding
   * frontend flow.
   *
   * New payout increments this generation so async
   * work from the detached flow can no longer attach
   * old intent / settlement state to the new draft.
   */
  const routeFlowGenerationRef =
    useRef(
      0
    );

  useEffect(() => {
    payoutIntentIdRef.current =
      payoutIntentId ||
      null;
  }, [
    payoutIntentId
  ]);

  const {
    payoutAccessToken,
    authorizeIntentWithWallet,
    ensureIntentAuthorized
  } = usePayoutAuthorization({
    payoutIntentId,
    address,
    walletClient,
    setWalletConfirmationPending,
    writeDebug
  });

  const {
    pollSettlementAfterFunding,
    cancelSettlementPolling
  } = useSettlementPolling({
    selectedRoute,
    form,
    setSettlement,
    writeDebug
  });

  const {
    sendFundingTransaction
  } = useFundingTransaction({
    address,
    chainId,
    walletClient,
    switchChainAsync,
    settlement,
    payoutIntentId,
    payoutIntentIdRef,
    setFundingTxHash,
    setIsBusy,
    setWalletConfirmationPending,
    pollSettlementAfterFunding,
    writeDebug
  });

  const {
    startNewFlow,
    continueAfterKyc
  } = usePayoutIntentFlow({
    isConnected,
    address,
    chainId,
    connectSessionId,
    selectedRoute,
    form,
    pricingPreview,

    payoutIntentId,
    payoutIntentIdRef,
    routeFlowGenerationRef,
    setPayoutIntentId,
    setSettlement,
    setFundingTxHash,
    setIsBusy,
    setWalletConfirmationPending,

    repeatSourcePayoutIntentId,
    repeatAccessToken,

    authorizeIntentWithWallet,
    ensureIntentAuthorized,
    cancelSettlementPolling,

    writeDebug
  });

  function resetRouteFlowRuntime() {
    /*
     * Explicitly detach async work belonging to the
     * previous pre-funding frontend flow.
     */
    routeFlowGenerationRef.current += 1;

    /*
     * Stop any polling belonging to the previous
     * payout attempt before App detaches it.
     */
    cancelSettlementPolling();

    /*
     * New payout is an explicit frontend escape hatch.
     *
     * The abandoned pre-funding flow must not keep the
     * new draft blocked by runtime UI state.
     */
    setIsBusy(
      false
    );

    setWalletConfirmationPending(
      false
    );
  }

  async function handleSend() {
    /*
     * Capture the frontend flow that owns this send.
     *
     * If New payout is pressed while this operation
     * is pending, resetRouteFlowRuntime() increments
     * the generation and this operation becomes stale.
     */
    const flowGeneration =
      routeFlowGenerationRef.current;

    try {
      if (settlement?.funding) {
        await sendFundingTransaction();

        return;
      }

      if (isReturnedFlow) {
        if (
          !connectSessionId ||
          !selectedRoute
        ) {
          writeDebug(
            "Returned flow is still restoring.",
            {
              connect_session_id:
                connectSessionId ||
                null,

              route_id:
                selectedRoute?.id ||
                null
            }
          );

          return;
        }

        await continueAfterKyc();

        return;
      }

      await startNewFlow();
    }
    catch (
      err
    ) {
      /*
       * A detached flow must not clear wallet state
       * or overwrite debug state belonging to the
       * newly active payout flow.
       */
      if (
        routeFlowGenerationRef.current !==
        flowGeneration
      ) {
        return;
      }

      setWalletConfirmationPending(
        false
      );

      writeDebug(
        "Send failed",
        {
          message:
            err?.message ||
            "route_flow_failed"
        }
      );
    }
    finally {
      /*
       * New payout releases isBusy itself.
       *
       * Therefore an old detached send must never
       * clear isBusy after a newer payout has already
       * started.
       */
      if (
        routeFlowGenerationRef.current ===
        flowGeneration
      ) {
        setIsBusy(
          false
        );
      }
    }
  }

  return {
    startNewFlow,
    continueAfterKyc,
    sendFundingTransaction,
    handleSend,
    walletConfirmationPending,
    payoutAccessToken,
    resetRouteFlowRuntime
  };
}

export default useRouteFlow;
