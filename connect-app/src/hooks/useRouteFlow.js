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
    authorizeIntentWithWallet,
    ensureIntentAuthorized,
    cancelSettlementPolling,
    writeDebug
  });

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
            err.message
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
    payoutAccessToken
  };
}

export default useRouteFlow;
