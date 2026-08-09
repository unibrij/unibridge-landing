// connect-app/src/hooks/usePayoutAttemptLifecycle.js

import {
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";

import {
  getPayoutIntent
} from "../api.js";

import {
  clearStoredPayoutIntent
} from "../flow/flowStorage.js";

import {
  PAYOUT_ATTEMPT_STATE,
  resolvePayoutAttemptState,
  resolveSettlementCreationStatus
} from "../flow/payoutAttempt.js";

import {
  removeQueryParams
} from "../flow/urlState.js";

function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}

export default function usePayoutAttemptLifecycle({
  payoutIntentId,
  payoutIntentIdStateRef,

  returnedPayoutIntentId,

  setPayoutIntentId,
  setSettlement,
  setFundingTxHash,
  setReturnedFlowDismissed
}) {
  /*
   * Existing attempts begin conservatively locked
   * until Core confirms their lifecycle.
   */
  const [
    payoutAttemptState,
    setPayoutAttemptState
  ] = useState(
    payoutIntentId
      ? PAYOUT_ATTEMPT_STATE
          .LOCKED_RECOVERY
      : PAYOUT_ATTEMPT_STATE
          .EDITABLE
  );

  /*
   * Authoritative Core settlement-creation status.
   *
   * Kept separate from the generalized attempt
   * state because the UI needs to distinguish
   * CREATING from READY.
   */
  const [
    settlementCreationStatus,
    setSettlementCreationStatus
  ] = useState(null);

  /*
   * Tracks intent identity independently from
   * lifecycle refreshes.
   *
   * Same-intent refresh:
   * preserve the last authoritative lifecycle.
   *
   * New / different intent:
   * lock conservatively until its first Core read.
   */
  const lastObservedIntentIdRef =
    useRef(
      normalizeString(
        payoutIntentId
      ) ||
      null
    );

  /*
   * Explicit refresh trigger after user-driven
   * payout actions.
   */
  const [
    refreshNonce,
    setRefreshNonce
  ] = useState(0);

  const refreshPayoutAttempt =
    useCallback(
      () => {
        setRefreshNonce(
          current =>
            current + 1
        );
      },
      []
    );

  /*
   * Local lifecycle reset only.
   *
   * The caller owns payoutIntentId / settlement /
   * funding state because those belong to broader
   * payout orchestration.
   */
  const resetPayoutAttemptLifecycle =
    useCallback(
      () => {
        lastObservedIntentIdRef.current =
          null;

        setSettlementCreationStatus(
          null
        );

        setPayoutAttemptState(
          PAYOUT_ATTEMPT_STATE
            .EDITABLE
        );
      },
      []
    );

  useEffect(() => {
    let cancelled =
      false;

    const intentId =
      normalizeString(
        payoutIntentId
      );

    const normalizedIntentId =
      intentId ||
      null;

    const previousIntentId =
      lastObservedIntentIdRef.current;

    const intentChanged =
      previousIntentId !==
      normalizedIntentId;

    lastObservedIntentIdRef.current =
      normalizedIntentId;

    payoutIntentIdStateRef.current =
      normalizedIntentId;

    /*
     * No active intent means there is nothing for
     * Core to restore.
     */
    if (!intentId) {
      setSettlementCreationStatus(
        null
      );

      setPayoutAttemptState(
        PAYOUT_ATTEMPT_STATE
          .EDITABLE
      );

      return () => {
        cancelled =
          true;
      };
    }

    /*
     * A newly observed payout intent has no trusted
     * lifecycle in this hook yet.
     *
     * Lock it conservatively until Core confirms the
     * actual state.
     *
     * A refresh of the same intent deliberately
     * skips this block so the last authoritative
     * lifecycle remains visible and usable while
     * the GET is in flight.
     */
    if (intentChanged) {
      setSettlementCreationStatus(
        null
      );

      setPayoutAttemptState(
        PAYOUT_ATTEMPT_STATE
          .LOCKED_RECOVERY
      );
    }

    async function restoreAttemptState() {
      try {
        const intent =
          await getPayoutIntent({
            payoutIntentId:
              intentId
          });

        if (
          cancelled ||
          payoutIntentIdStateRef
            .current !== intentId
        ) {
          return;
        }

        const attemptState =
          resolvePayoutAttemptState(
            intent
          );

        const creationStatus =
          resolveSettlementCreationStatus(
            intent
          );

        /*
         * Safe pre-side-effect failure:
         *
         * FAILED + reserved/prepared resolves to
         * EDITABLE.
         *
         * Product behavior retires that intent
         * locally. The next Continue must create a
         * new payout intent rather than reusing it.
         */
        if (
          creationStatus ===
            "failed" &&
          attemptState ===
            PAYOUT_ATTEMPT_STATE
              .EDITABLE
        ) {
          const cameFromReturnedUrl =
            normalizeString(
              returnedPayoutIntentId
            ) ===
            intentId;

          clearStoredPayoutIntent();

          lastObservedIntentIdRef.current =
            null;

          payoutIntentIdStateRef.current =
            null;

          setPayoutIntentId(
            current =>
              current === intentId
                ? null
                : current
          );

          setSettlementCreationStatus(
            null
          );

          setPayoutAttemptState(
            PAYOUT_ATTEMPT_STATE
              .EDITABLE
          );

          setSettlement(
            null
          );

          setFundingTxHash(
            null
          );

          /*
           * Remove only the returned payout-intent
           * parameter.
           *
           * Repeat-source and route parameters must
           * survive safe failure of a newly-created
           * repeat attempt.
           */
          if (
            cameFromReturnedUrl
          ) {
            setReturnedFlowDismissed(
              true
            );

            removeQueryParams([
              "payout_intent_id"
            ]);
          }

          return;
        }

        /*
         * Core lifecycle is authoritative from this
         * point onward.
         */
        setSettlementCreationStatus(
          creationStatus
        );

        setPayoutAttemptState(
          attemptState
        );
      }
      catch (
        error
      ) {
        if (
          cancelled ||
          payoutIntentIdStateRef
            .current !== intentId
        ) {
          return;
        }

        /*
         * A locally restored intent that no longer
         * exists in Core can be detached safely.
         */
        if (
          error?.message ===
          "payout_intent_not_found"
        ) {
          const cameFromReturnedUrl =
            normalizeString(
              returnedPayoutIntentId
            ) ===
            intentId;

          clearStoredPayoutIntent();

          lastObservedIntentIdRef.current =
            null;

          payoutIntentIdStateRef.current =
            null;

          setPayoutIntentId(
            current =>
              current === intentId
                ? null
                : current
          );

          setSettlementCreationStatus(
            null
          );

          setPayoutAttemptState(
            PAYOUT_ATTEMPT_STATE
              .EDITABLE
          );

          setSettlement(
            null
          );

          setFundingTxHash(
            null
          );

          if (
            cameFromReturnedUrl
          ) {
            setReturnedFlowDismissed(
              true
            );

            removeQueryParams([
              "payout_intent_id"
            ]);
          }

          return;
        }

        /*
         * Failed authoritative lifecycle read:
         * never infer that transfer mutation is safe.
         */
        setSettlementCreationStatus(
          null
        );

        setPayoutAttemptState(
          PAYOUT_ATTEMPT_STATE
            .LOCKED_RECOVERY
        );
      }
    }

    void restoreAttemptState();

    return () => {
      cancelled =
        true;
    };
  }, [
    payoutIntentId,
    payoutIntentIdStateRef,
    refreshNonce,
    returnedPayoutIntentId,
    setFundingTxHash,
    setPayoutIntentId,
    setReturnedFlowDismissed,
    setSettlement
  ]);

  return {
    payoutAttemptState,
    settlementCreationStatus,

    refreshPayoutAttempt,
    resetPayoutAttemptLifecycle
  };
}
