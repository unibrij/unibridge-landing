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
     * Stop any polling belonging to the previous
     * payout attempt before App detaches it.
     *
     * This prevents an old async poll from writing
     * settlement state into a newly started payout.
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
      setIsBusy(
        false
      );
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
