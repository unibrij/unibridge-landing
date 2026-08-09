// connect-app/src/flow/payoutIntentLifecycle.js

import {
  createSettlement,
  getPayoutIntent
} from "../api";

import {
  clearStoredPayoutIntent
} from "./flowStorage";

import {
  PAYOUT_ATTEMPT_STATE,
  resolvePayoutAttemptState,
  resolveSettlementCreationStatus
} from "./payoutAttempt";

export function createPayoutIntentLifecycle({
  payoutIntentIdRef,

  setPayoutIntentId,
  setSettlement,
  setFundingTxHash,
  setWalletConfirmationPending,

  ensureIntentAuthorized,

  isFlowCurrent,
  getFlowGeneration,

  writeDebug
}) {
  function invalidateLocalPayoutIntent(
    intentId
  ) {
    const normalizedIntentId =
      String(
        intentId ||
        ""
      ).trim();

    /*
     * Protect a newer attempt from being cleared
     * by an older async operation.
     */
    if (
      normalizedIntentId &&
      payoutIntentIdRef.current &&
      payoutIntentIdRef.current !==
        normalizedIntentId
    ) {
      return;
    }

    payoutIntentIdRef.current =
      null;

    setPayoutIntentId(
      null
    );

    clearStoredPayoutIntent();
  }

  async function retireSafeFailedIntent(
    intentId,
    intent
  ) {
    const attemptState =
      resolvePayoutAttemptState(
        intent
      );

    const creationStatus =
      resolveSettlementCreationStatus(
        intent
      );

    if (
      creationStatus ===
        "failed" &&
      attemptState ===
        PAYOUT_ATTEMPT_STATE.EDITABLE
    ) {
      invalidateLocalPayoutIntent(
        intentId
      );

      writeDebug(
        "Safe pre-side-effect payout attempt failed. A new payout intent will be created on the next attempt.",
        {
          payout_intent_id:
            intentId
        }
      );

      return true;
    }

    return false;
  }

  async function createSettlementForIntent(
    intentId,
    flowGeneration =
      getFlowGeneration()
  ) {
    if (!intentId) {
      throw new Error(
        "payout_intent_id_required"
      );
    }

    writeDebug(
      "Preparing settlement...",
      {
        payout_intent_id:
          intentId
      }
    );

    try {
      const settlementResult =
        await createSettlement({
          payoutIntentId:
            intentId
        });

      if (
        !isFlowCurrent(
          flowGeneration
        )
      ) {
        return null;
      }

      setSettlement(
        settlementResult
      );

      setFundingTxHash(
        null
      );

      setWalletConfirmationPending(
        false
      );

      writeDebug(
        "Funding route ready. Send from wallet.",
        settlementResult
      );

      return settlementResult;
    }
    catch (err) {
      if (
        !isFlowCurrent(
          flowGeneration
        )
      ) {
        return null;
      }

      try {
        const latestIntent =
          await getPayoutIntent({
            payoutIntentId:
              intentId
          });

        if (
          !isFlowCurrent(
            flowGeneration
          )
        ) {
          return null;
        }

        const retired =
          await retireSafeFailedIntent(
            intentId,
            latestIntent
          );

        if (!retired) {
          const attemptState =
            resolvePayoutAttemptState(
              latestIntent
            );

          const creationStatus =
            resolveSettlementCreationStatus(
              latestIntent
            );

          writeDebug(
            attemptState ===
              PAYOUT_ATTEMPT_STATE
                .LOCKED_RECOVERY
              ? "Settlement creation crossed the safe boundary and requires recovery."
              : creationStatus ===
                  "creating"
                ? "Settlement creation is still in progress."
                : "Settlement creation remains attached to the current payout attempt.",
            {
              payout_intent_id:
                intentId,

              payout_attempt_state:
                attemptState,

              settlement_creation_status:
                creationStatus,

              settlement_creation_stage:
                latestIntent
                  ?.settlement_creation_stage ||
                null
            }
          );
        }
      }
      catch (lifecycleError) {
        if (
          !isFlowCurrent(
            flowGeneration
          )
        ) {
          return null;
        }

        writeDebug(
          "Could not resolve payout lifecycle after settlement failure. Existing payout intent was preserved.",
          {
            payout_intent_id:
              intentId,

            lifecycle_error:
              lifecycleError
                ?.message ||
              String(
                lifecycleError
              )
          }
        );
      }

      throw err;
    }
  }

  async function continueExistingIntent(
    intentId,
    existingIntent = null,
    flowGeneration =
      getFlowGeneration()
  ) {
    const resolvedIntent =
      existingIntent ||
      await getPayoutIntent({
        payoutIntentId:
          intentId
      });

    if (
      !isFlowCurrent(
        flowGeneration
      )
    ) {
      return null;
    }

    const attemptState =
      resolvePayoutAttemptState(
        resolvedIntent
      );

    const creationStatus =
      resolveSettlementCreationStatus(
        resolvedIntent
      );

    if (
      await retireSafeFailedIntent(
        intentId,
        resolvedIntent
      )
    ) {
      return null;
    }

    if (
      attemptState ===
        PAYOUT_ATTEMPT_STATE
          .LOCKED_RECOVERY
    ) {
      writeDebug(
        "This payout requires recovery before it can continue.",
        {
          payout_intent_id:
            intentId,

          settlement_creation_status:
            creationStatus,

          settlement_creation_stage:
            resolvedIntent
              ?.settlement_creation_stage ||
            null
        }
      );

      throw new Error(
        "connect_settlement_recovery_required"
      );
    }

    if (
      creationStatus ===
      "creating"
    ) {
      writeDebug(
        "Settlement creation is already in progress.",
        {
          payout_intent_id:
            intentId
        }
      );

      throw new Error(
        "connect_settlement_creation_in_progress"
      );
    }

    try {
      await ensureIntentAuthorized({
        intentId,

        authorizationStatus:
          resolvedIntent
            ?.authorization_status
      });

      if (
        !isFlowCurrent(
          flowGeneration
        )
      ) {
        return null;
      }
    }
    catch (err) {
      if (
        !isFlowCurrent(
          flowGeneration
        )
      ) {
        return null;
      }

      if (
        attemptState ===
          PAYOUT_ATTEMPT_STATE.EDITABLE &&
        !creationStatus
      ) {
        invalidateLocalPayoutIntent(
          intentId
        );
      }

      throw err;
    }

    return createSettlementForIntent(
      intentId,
      flowGeneration
    );
  }

  return {
    invalidateLocalPayoutIntent,
    retireSafeFailedIntent,
    createSettlementForIntent,
    continueExistingIntent
  };
}

export default createPayoutIntentLifecycle;
