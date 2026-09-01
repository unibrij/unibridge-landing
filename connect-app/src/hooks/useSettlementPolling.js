// connect-app/src/hooks/useSettlementPolling.js

import {
  useEffect,
  useRef
} from "react";

import {
  getPayoutIntent
} from "../api";

import {
  getSettlementId,
  isCompletedStatus,
  isTerminalFailureStatus,
  pickSettlementLike,
  sleep
} from "../flow/routeFlowUtils";


const STATUS_POLL_INTERVAL_MS =
  4000;

const STATUS_POLL_MAX_ATTEMPTS =
  24;


export function useSettlementPolling({
  setSettlement,
  writeDebug
}) {
  const statusPollTokenRef =
    useRef(
      null
    );

  useEffect(() => {
    return () => {
      statusPollTokenRef.current =
        null;
    };
  }, []);

  function cancelSettlementPolling() {
    statusPollTokenRef.current =
      null;
  }

  async function pollSettlementAfterFunding({
    intentId,
    txHash
  }) {
    if (!intentId) {
      writeDebug(
        "Wallet submitted. Waiting for route update.",
        {
          tx_hash:
            txHash,

          reason:
            "missing_payout_intent_id"
        }
      );

      return;
    }

    const pollToken =
      `${intentId}:${txHash}:${Date.now()}`;

    statusPollTokenRef.current =
      pollToken;

    writeDebug(
      "Wallet submitted. Checking route status...",
      {
        payout_intent_id:
          intentId,

        tx_hash:
          txHash,

        polling_interval_ms:
          STATUS_POLL_INTERVAL_MS,

        max_attempts:
          STATUS_POLL_MAX_ATTEMPTS
      }
    );

    for (
      let attempt = 1;
      attempt <=
        STATUS_POLL_MAX_ATTEMPTS;
      attempt += 1
    ) {
      if (
        statusPollTokenRef.current !==
        pollToken
      ) {
        return;
      }

      await sleep(
        STATUS_POLL_INTERVAL_MS
      );

      if (
        statusPollTokenRef.current !==
        pollToken
      ) {
        return;
      }

      try {
        const intent =
          await getPayoutIntent({
            payoutIntentId:
              intentId
          });

        const refreshed =
          pickSettlementLike(
            intent
          );

        if (
          statusPollTokenRef.current !==
          pollToken
        ) {
          return;
        }

        setSettlement(
          current => ({
            ...current,

            settlement_id:
              refreshed
                .settlement_id ??
              current
                ?.settlement_id ??
              null,

            status:
              refreshed.status ??
              current?.status ??
              null,

            settlement_status:
              refreshed
                .settlement_status ??
              current
                ?.settlement_status ??
              null,

            live_settlement_status:
              refreshed
                .live_settlement_status ??
              current
                ?.live_settlement_status ??
              null,

            public_route_status:
              refreshed
                .public_route_status ??
              current
                ?.public_route_status ??
              null
          })
        );

        if (
          isCompletedStatus(
            refreshed?.status
          )
        ) {
          const settlementId =
            getSettlementId(
              refreshed
            );

          writeDebug(
            "Payout completed.",
            {
              payout_intent_id:
                intentId,

              settlement_id:
                settlementId,

              tx_hash:
                txHash,

              status:
                refreshed?.status,

              live_settlement_status:
                refreshed
                  ?.live_settlement_status ||
                null,

              public_route_status:
                refreshed
                  ?.public_route_status ||
                null
            }
          );

          statusPollTokenRef.current =
            null;

          return;
        }

        if (
          isTerminalFailureStatus(
            refreshed?.status
          )
        ) {
          writeDebug(
            "Payout did not complete.",
            {
              payout_intent_id:
                intentId,

              settlement_id:
                getSettlementId(
                  refreshed
                ),

              tx_hash:
                txHash,

              status:
                refreshed?.status,

              live_settlement_status:
                refreshed
                  ?.live_settlement_status ||
                null,

              public_route_status:
                refreshed
                  ?.public_route_status ||
                null
            }
          );

          statusPollTokenRef.current =
            null;

          return;
        }
      }
      catch (
        err
      ) {
        writeDebug(
          "Route status check failed",
          {
            payout_intent_id:
              intentId,

            tx_hash:
              txHash,

            attempt,

            message:
              err?.message ||
              String(
                err
              )
          }
        );
      }
    }

    if (
      statusPollTokenRef.current ===
      pollToken
    ) {
      statusPollTokenRef.current =
        null;
    }

    writeDebug(
      "Wallet submitted. Route completion still pending.",
      {
        payout_intent_id:
          intentId,

        tx_hash:
          txHash,

        status:
          "still_waiting"
      }
    );
  }

  return {
    pollSettlementAfterFunding,
    cancelSettlementPolling
  };
}


export default useSettlementPolling;
