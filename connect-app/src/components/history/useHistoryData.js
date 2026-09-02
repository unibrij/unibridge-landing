// connect-app/src/components/history/useHistoryData.js

import {
  useEffect,
  useState
} from "react";

import {
  getPayoutHistory
} from "../../api";

import {
  normalizeWalletAddress
} from "./historyUtils.js";


function projectRecentPayouts(
  result
) {
  return Array.isArray(
    result?.recent_payouts
  )
    ? result.recent_payouts
    : [];
}


export function useHistoryData({
  isConnected = false,
  address
}) {
  const [
    recentPayouts,
    setRecentPayouts
  ] = useState([]);

  const [
    historyStatus,
    setHistoryStatus
  ] = useState("idle");

  const [
    historyError,
    setHistoryError
  ] = useState(null);

  const [
    retryKey,
    setRetryKey
  ] = useState(0);


  useEffect(() => {
    let cancelled =
      false;


    async function loadHistory() {
      const walletAddress =
        normalizeWalletAddress(
          address
        );

      if (
        !isConnected ||
        !walletAddress
      ) {
        setRecentPayouts(
          []
        );

        setHistoryStatus(
          "disconnected"
        );

        setHistoryError(
          null
        );

        return;
      }

      setHistoryStatus(
        "loading"
      );

      setHistoryError(
        null
      );

      try {
        const result =
          await getPayoutHistory({
            walletAddress,
            limit:
              20
          });

        if (cancelled) {
          return;
        }

        setRecentPayouts(
          projectRecentPayouts(
            result
          )
        );

        setHistoryStatus(
          "ready"
        );

        setHistoryError(
          null
        );
      }
      catch (
        error
      ) {
        if (cancelled) {
          return;
        }

        setRecentPayouts(
          []
        );

        setHistoryStatus(
          "error"
        );

        setHistoryError(
          error?.message ||
          "get_payout_history_failed"
        );
      }
    }


    void loadHistory();

    return () => {
      cancelled =
        true;
    };
  }, [
    isConnected,
    address,
    retryKey
  ]);


  function retryHistory() {
    setHistoryError(
      null
    );

    setRetryKey(
      value =>
        value + 1
    );
  }


  return {
    recentPayouts,
    historyStatus,
    historyError,
    retryHistory
  };
}
