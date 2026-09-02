// connect-app/src/components/history/useHistoryData.js

import {
  useEffect,
  useRef,
  useState
} from "react";

import {
  createHistoryChallenge,
  getPayoutHistory,
  getWalletPayoutHistory
} from "../../api";

import {
  normalizeString,
  normalizeWalletAddress
} from "./historyUtils.js";


function isWalletSignatureRejected(
  error
) {
  const code =
    error?.code ??
    error?.cause?.code;

  if (
    Number(
      code
    ) === 4001
  ) {
    return true;
  }

  const name =
    normalizeString(
      error?.name
    ).toLowerCase();

  if (
    name.includes(
      "userrejected"
    )
  ) {
    return true;
  }

  const message =
    normalizeString(
      error?.message
    ).toLowerCase();

  return (
    message.includes(
      "user rejected"
    ) ||
    message.includes(
      "user denied"
    ) ||
    message.includes(
      "rejected the request"
    ) ||
    message.includes(
      "request rejected"
    ) ||
    message.includes(
      "cancelled"
    ) ||
    message.includes(
      "canceled"
    )
  );
}


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
  accessToken,
  isConnected = false,
  address,
  walletClient,
  connectSessionId
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

  /*
   * Prevent duplicate wallet-sign requests when
   * React StrictMode re-runs effects in development.
   */
  const walletHistoryLoadRef =
    useRef(null);


  useEffect(() => {
    let cancelled =
      false;


    function applyHistory(
      result
    ) {
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


    async function loadPatHistory() {
      setHistoryStatus(
        "loading"
      );

      setHistoryError(
        null
      );

      try {
        const result =
          await getPayoutHistory({
            accessToken,
            limit:
              20
          });

        applyHistory(
          result
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


    async function createWalletHistoryRequest() {
      const normalizedAddress =
        normalizeWalletAddress(
          address
        );

      const normalizedConnectSessionId =
        normalizeString(
          connectSessionId
        );

      const challenge =
        await createHistoryChallenge({
          connectSessionId:
            normalizedConnectSessionId
        });

      const challengeMessage =
        normalizeString(
          challenge?.message
        );

      const challengeNonce =
        normalizeString(
          challenge?.nonce
        );

      const challengeWalletAddress =
        normalizeWalletAddress(
          challenge?.wallet_address
        );

      const challengeConnectSessionId =
        normalizeString(
          challenge?.connect_session_id
        );

      if (
        !challengeMessage ||
        !challengeNonce ||
        !challengeWalletAddress
      ) {
        throw new Error(
          "history_challenge_incomplete"
        );
      }

      if (
        challengeWalletAddress !==
          normalizedAddress
      ) {
        throw new Error(
          "history_authorization_wallet_mismatch"
        );
      }

      if (
        challengeConnectSessionId &&
        challengeConnectSessionId !==
          normalizedConnectSessionId
      ) {
        throw new Error(
          "history_connect_session_mismatch"
        );
      }

      const signature =
        await walletClient
          .signMessage({
            account:
              address,

            message:
              challengeMessage
          });

      return getWalletPayoutHistory({
        connectSessionId:
          normalizedConnectSessionId,

        nonce:
          challengeNonce,

        signature,

        limit:
          20
      });
    }


    async function loadWalletHistory() {
      const normalizedAddress =
        normalizeWalletAddress(
          address
        );

      const normalizedConnectSessionId =
        normalizeString(
          connectSessionId
        );

      if (
        !isConnected ||
        !normalizedAddress
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

      if (
        !normalizedConnectSessionId ||
        !walletClient ||
        typeof walletClient.signMessage !==
          "function"
      ) {
        setRecentPayouts(
          []
        );

        setHistoryStatus(
          "preparing"
        );

        setHistoryError(
          null
        );

        return;
      }

      setHistoryStatus(
        "verifying"
      );

      setHistoryError(
        null
      );

      const requestKey =
        [
          normalizedAddress,
          normalizedConnectSessionId,
          String(
            retryKey
          )
        ].join(
          "|"
        );

      let activeRequest =
        walletHistoryLoadRef.current;

      if (
        !activeRequest ||
        activeRequest.key !==
          requestKey
      ) {
        const promise =
          createWalletHistoryRequest();

        activeRequest = {
          key:
            requestKey,

          promise
        };

        walletHistoryLoadRef.current =
          activeRequest;

        const clearRequest =
          () => {
            if (
              walletHistoryLoadRef
                .current
                ?.promise ===
              promise
            ) {
              walletHistoryLoadRef.current =
                null;
            }
          };

        promise.then(
          clearRequest,
          clearRequest
        );
      }

      try {
        const result =
          await activeRequest.promise;

        applyHistory(
          result
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

        if (
          isWalletSignatureRejected(
            error
          )
        ) {
          setHistoryStatus(
            "signature_cancelled"
          );

          setHistoryError(
            null
          );

          return;
        }

        setHistoryStatus(
          "error"
        );

        setHistoryError(
          error?.message ||
          "get_wallet_payout_history_failed"
        );
      }
    }


    if (accessToken) {
      void loadPatHistory();
    }
    else {
      void loadWalletHistory();
    }

    return () => {
      cancelled =
        true;
    };
  }, [
    accessToken,
    isConnected,
    address,
    walletClient,
    connectSessionId,
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
