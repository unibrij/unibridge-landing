// connect-app/src/hooks/usePayoutIntentFlow.js

import {
  createPayoutIntent,
  getPayoutIntent,
  repeatPayout,
  startKyc
} from "../api";

import {
  readStoredFlow,
  storeFlowSnapshot
} from "../flow/flowStorage";

import {
  PAYOUT_ATTEMPT_STATE,
  resolvePayoutAttemptState,
  resolveSettlementCreationStatus,
  isStalePreCommitIntent
} from "../flow/payoutAttempt";

import {
  isKycAlreadyPassed,
  isMissingKycUrlError
} from "../flow/kyc";

import {
  normalizePricingPreview,
  getPayoutIntentId
} from "../flow/routeFlowUtils";

import {
  normalizeAuthorizationStatus,
  requireNormalFlowContext,
  requireReceiveFlowContext,
  requireRepeatFlowContext,
  buildCurrentTransferFingerprint
} from "../flow/payoutFlowContext";

import {
  createPayoutIntentLifecycle
} from "../flow/payoutIntentLifecycle";

import {
  openPayoutKyc
} from "../flow/payoutKycFlow";

export function usePayoutIntentFlow({
  isConnected,
  address,
  chainId,
  connectSessionId,
  selectedRoute,
  form,
  pricingPreview,
  receiveProfileId,

  payoutIntentIdRef,
  routeFlowGenerationRef,
  kycCompletionPendingRef,

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
}) {
  const isRepeatFlow =
    Boolean(
      repeatSourcePayoutIntentId
    );

  const isReceiveFlow =
    Boolean(
      !isRepeatFlow &&
      String(
        receiveProfileId ||
        ""
      ).trim()
    );

  function getFlowGeneration() {
    return (
      routeFlowGenerationRef
        ?.current ??
      0
    );
  }

  function isFlowCurrent(
    generation
  ) {
    return (
      getFlowGeneration() ===
      generation
    );
  }

  function requireCurrentFlowContext() {
    if (isRepeatFlow) {
      requireRepeatFlowContext({
        connectSessionId,
        repeatSourcePayoutIntentId,
        repeatAccessToken,
        form
      });

      return;
    }

    if (isReceiveFlow) {
      requireReceiveFlowContext({
        connectSessionId,
        selectedRoute,
        address,
        form,
        receiveProfileId
      });

      return;
    }

    requireNormalFlowContext({
      connectSessionId,
      selectedRoute,
      address,
      form
    });
  }

  function buildTransferFingerprint() {
    return buildCurrentTransferFingerprint({
      selectedRoute,
      form,
      repeatSourcePayoutIntentId,
      receiveProfileId:
        isReceiveFlow
          ? receiveProfileId
          : null
    });
  }

  const {
    invalidateLocalPayoutIntent,
    retireSafeFailedIntent,
    createSettlementForIntent,
    continueExistingIntent
  } =
    createPayoutIntentLifecycle({
      payoutIntentIdRef,

      setPayoutIntentId,
      setSettlement,
      setFundingTxHash,
      setWalletConfirmationPending,

      ensureIntentAuthorized,

      isFlowCurrent,
      getFlowGeneration,

      writeDebug
    });

  async function createIntentAndSettlement(
    flowGeneration =
      getFlowGeneration()
  ) {
    requireCurrentFlowContext();

    writeDebug(
      isRepeatFlow
        ? "Creating repeated payout intent..."
        : "Creating payout intent...",
      {
        connect_session_id:
          connectSessionId,

        route_id:
          selectedRoute?.id ||
          null,

        chain_id:
          chainId ||
          null,

        receive_profile_id:
          isReceiveFlow
            ? receiveProfileId
            : null,

        repeat_source_payout_intent_id:
          repeatSourcePayoutIntentId ||
          null
      }
    );

    const intentResult =
      isRepeatFlow
        ? await repeatPayout({
            sourcePayoutIntentId:
              repeatSourcePayoutIntentId,

            connectSessionId,

            amount:
              form.amount,

            accessToken:
              repeatAccessToken
          })
        : await createPayoutIntent({
            connectSessionId,

            walletAddress:
              address,

            route:
              selectedRoute,

            form,

            receiveProfileId:
              isReceiveFlow
                ? receiveProfileId
                : null
          });

    /*
     * The user may have detached this attempt while
     * intent creation was pending.
     */
    if (
      !isFlowCurrent(
        flowGeneration
      )
    ) {
      return null;
    }

    const intentId =
      getPayoutIntentId(
        intentResult
      );

    if (!intentId) {
      throw new Error(
        "payout_intent_id_missing"
      );
    }

    payoutIntentIdRef.current =
      intentId;

    setPayoutIntentId(
      intentId
    );

    storeFlowSnapshot({
      connect_session_id:
        connectSessionId,

      payout_intent_id:
        intentId,

      repeat_source_payout_intent_id:
        repeatSourcePayoutIntentId ||
        null,

      route_id:
        selectedRoute?.id ||
        null,

      transfer_fingerprint:
        buildTransferFingerprint(),

      form,

      pricing_preview:
        isRepeatFlow
          ? null
          : normalizePricingPreview(
              pricingPreview
            )
    });

    writeDebug(
      isRepeatFlow
        ? "Repeated payout intent created."
        : "Payout intent created.",
      {
        payout_intent_id:
          intentId,

        receive_profile_id:
          isReceiveFlow
            ? receiveProfileId
            : null,

        repeat_source_payout_intent_id:
          repeatSourcePayoutIntentId ||
          null
      }
    );

    try {
      const authorization =
        await authorizeIntentWithWallet(
          intentId
        );

      if (
        !isFlowCurrent(
          flowGeneration
        )
      ) {
        return null;
      }

      const settlement =
        await createSettlementForIntent(
          intentId,
          flowGeneration
        );

      if (
        !isFlowCurrent(
          flowGeneration
        )
      ) {
        return null;
      }

      return {
        intentId,

        intent:
          intentResult,

        authorization,

        settlement
      };
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
        payoutIntentIdRef.current ===
          intentId
      ) {
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

          const attemptState =
            resolvePayoutAttemptState(
              latestIntent
            );

          const creationStatus =
            resolveSettlementCreationStatus(
              latestIntent
            );

          if (
            !creationStatus &&
            attemptState ===
              PAYOUT_ATTEMPT_STATE
                .EDITABLE
          ) {
            invalidateLocalPayoutIntent(
              intentId
            );
          }
        }
        catch {
          /*
           * Preserve intent when authoritative
           * lifecycle cannot be resolved.
           */
        }
      }

      throw err;
    }
  }

  async function continueAfterKyc(
    suppliedIntentId,
    flowGeneration =
      getFlowGeneration()
  ) {
    setIsBusy(
      true
    );

    /*
     * Only an explicitly supplied id or the mutable
     * ref may resume an existing attempt.
     */
    const existingIntentId =
      suppliedIntentId ||
      payoutIntentIdRef.current ||
      null;

    if (existingIntentId) {
      const existingIntent =
        await getPayoutIntent({
          payoutIntentId:
            existingIntentId
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
          existingIntent
        );

      const creationStatus =
        resolveSettlementCreationStatus(
          existingIntent
        );

      if (
        await retireSafeFailedIntent(
          existingIntentId,
          existingIntent
        )
      ) {
        writeDebug(
          isRepeatFlow
            ? "Creating a new repeated payout intent..."
            : "Creating a new payout intent..."
        );

        const result =
          await createIntentAndSettlement(
            flowGeneration
          );

        return (
          result?.settlement ||
          null
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
              existingIntentId
          }
        );

        throw new Error(
          "connect_settlement_creation_in_progress"
        );
      }

      if (
        attemptState ===
          PAYOUT_ATTEMPT_STATE
            .LOCKED_RECOVERY
      ) {
        writeDebug(
          "Existing payout requires recovery.",
          {
            payout_intent_id:
              existingIntentId,

            settlement_creation_status:
              creationStatus,

            settlement_creation_stage:
              existingIntent
                ?.settlement_creation_stage ||
              null
          }
        );

        throw new Error(
          "connect_settlement_recovery_required"
        );
      }

      if (
        attemptState ===
          PAYOUT_ATTEMPT_STATE
            .LOCKED_RESUMABLE
      ) {
        return continueExistingIntent(
          existingIntentId,
          existingIntent,
          flowGeneration
        );
      }

      const storedFlow =
        readStoredFlow();

      const staleIntent =
        isStalePreCommitIntent({
          intent:
            existingIntent,

          storedFingerprint:
            storedFlow
              ?.transfer_fingerprint,

          currentFingerprint:
            buildTransferFingerprint()
        });

      if (staleIntent) {
        invalidateLocalPayoutIntent(
          existingIntentId
        );

        writeDebug(
          "Transfer details changed before settlement creation. Creating a new payout intent.",
          {
            payout_intent_id:
              existingIntentId
          }
        );
      }
      else {
        return continueExistingIntent(
          existingIntentId,
          existingIntent,
          flowGeneration
        );
      }
    }

    writeDebug(
      isRepeatFlow
        ? "Verification completed. Creating repeated payout intent..."
        : "Verification completed. Creating payout intent..."
    );

    const result =
      await createIntentAndSettlement(
        flowGeneration
      );

    return (
      result?.settlement ||
      null
    );
  }

  async function inspectExistingIntent(
    flowGeneration
  ) {
    const existingIntentId =
      payoutIntentIdRef.current ||
      null;

    if (!existingIntentId) {
      return {
        handled:
          false
      };
    }

    const existingIntent =
      await getPayoutIntent({
        payoutIntentId:
          existingIntentId
      });

    if (
      !isFlowCurrent(
        flowGeneration
      )
    ) {
      return {
        handled:
          true,

        result:
          undefined
      };
    }

    const attemptState =
      resolvePayoutAttemptState(
        existingIntent
      );

    const creationStatus =
      resolveSettlementCreationStatus(
        existingIntent
      );

    if (
      await retireSafeFailedIntent(
        existingIntentId,
        existingIntent
      )
    ) {
      return {
        handled:
          false
      };
    }

    if (
      creationStatus ===
        "creating"
    ) {
      writeDebug(
        "Settlement creation is already in progress.",
        {
          payout_intent_id:
            existingIntentId
        }
      );

      throw new Error(
        "connect_settlement_creation_in_progress"
      );
    }

    if (
      attemptState ===
        PAYOUT_ATTEMPT_STATE
          .LOCKED_RECOVERY
    ) {
      writeDebug(
        "Existing payout requires recovery.",
        {
          payout_intent_id:
            existingIntentId,

          settlement_creation_status:
            creationStatus,

          settlement_creation_stage:
            existingIntent
              ?.settlement_creation_stage ||
            null
        }
      );

      throw new Error(
        "connect_settlement_recovery_required"
      );
    }

    if (
      attemptState ===
        PAYOUT_ATTEMPT_STATE
          .LOCKED_RESUMABLE
    ) {
      return {
        handled:
          true,

        result:
          await continueExistingIntent(
            existingIntentId,
            existingIntent,
            flowGeneration
          )
      };
    }

    const authorizationStatus =
      normalizeAuthorizationStatus(
        existingIntent
          ?.authorization_status
      );

    /*
     * Unsigned editable attempts may simply be
     * waiting for wallet confirmation.
     */
    if (
      attemptState ===
        PAYOUT_ATTEMPT_STATE
          .EDITABLE &&
      authorizationStatus !==
        "signed"
    ) {
      return {
        handled:
          true,

        result:
          await continueExistingIntent(
            existingIntentId,
            existingIntent,
            flowGeneration
          )
      };
    }

    /*
     * Signed editable attempts remain before
     * settlement side effects and may be replaced.
     */
    if (
      attemptState ===
        PAYOUT_ATTEMPT_STATE
          .EDITABLE
    ) {
      if (!isRepeatFlow) {
        const normalizedPricing =
          normalizePricingPreview(
            pricingPreview
          );

        if (!normalizedPricing) {
          writeDebug(
            "Pricing preview is required before continuing.",
            {
              connect_session_id:
                connectSessionId,

              route_id:
                selectedRoute?.id ||
                null
            }
          );

          return {
            handled:
              true,

            result:
              undefined
          };
        }
      }

      requireCurrentFlowContext();

      invalidateLocalPayoutIntent(
        existingIntentId
      );

      writeDebug(
        "Previous pre-creation payout authorization was detached. Starting a fresh payout attempt.",
        {
          previous_payout_intent_id:
            existingIntentId
        }
      );
    }

    return {
      handled:
        false
    };
  }

  function prepareNewAttempt(
    normalizedPricingPreview
  ) {
    setIsBusy(
      true
    );

    setSettlement(
      null
    );

    payoutIntentIdRef.current =
      null;

    setPayoutIntentId(
      null
    );

    setFundingTxHash(
      null
    );

    setWalletConfirmationPending(
      false
    );

    cancelSettlementPolling();

    storeFlowSnapshot({
      connect_session_id:
        connectSessionId,

      payout_intent_id:
        null,

      repeat_source_payout_intent_id:
        repeatSourcePayoutIntentId ||
        null,

      route_id:
        selectedRoute?.id ||
        null,

      transfer_fingerprint:
        null,

      form,

      pricing_preview:
        isRepeatFlow
          ? null
          : normalizedPricingPreview
    });
  }

  async function startNewFlow() {
    if (!isConnected) {
      writeDebug(
        "Connect your wallet first."
      );

      return;
    }

    if (!address) {
      writeDebug(
        "Wallet address missing."
      );

      return;
    }

    if (!connectSessionId) {
      writeDebug(
        "Connect session is still preparing. Try again in a moment."
      );

      return;
    }

    if (
      !selectedRoute &&
      !isRepeatFlow
    ) {
      writeDebug(
        "Select a payout route first."
      );

      return;
    }

    const flowGeneration =
      getFlowGeneration();

    const existing =
      await inspectExistingIntent(
        flowGeneration
      );

    if (existing.handled) {
      return existing.result;
    }

    let normalizedPricingPreview =
      null;

    if (!isRepeatFlow) {
      normalizedPricingPreview =
        normalizePricingPreview(
          pricingPreview
        );

      if (!normalizedPricingPreview) {
        writeDebug(
          "Pricing preview is required before continuing.",
          {
            connect_session_id:
              connectSessionId,

            route_id:
              selectedRoute?.id ||
              null
          }
        );

        return;
      }
    }

    requireCurrentFlowContext();

    prepareNewAttempt(
      normalizedPricingPreview
    );

    writeDebug(
      "Starting verification...",
      {
        connect_session_id:
          connectSessionId,

        route_id:
          selectedRoute?.id ||
          null,

        receive_profile_id:
          isReceiveFlow
            ? receiveProfileId
            : null,

        repeat_source_payout_intent_id:
          repeatSourcePayoutIntentId ||
          null
      }
    );

    try {
      const kyc =
        await startKyc({
          connectSessionId
        });

      if (
        !isFlowCurrent(
          flowGeneration
        )
      ) {
        return;
      }

      if (
        kyc?.skipped ||
        isKycAlreadyPassed(
          kyc
        )
      ) {
        writeDebug(
          "Verification already completed.",
          {
            connect_session_id:
              connectSessionId,

            kyc_status:
              kyc?.kyc_status ||
              null,

            verification_status:
              kyc
                ?.verification_status ||
              null,

            next_step:
              kyc?.next_step ||
              null
          }
        );

        await continueAfterKyc(
          null,
          flowGeneration
        );

        return;
      }

      if (!kyc?.url) {
        throw new Error(
          "kyc_url_missing"
        );
      }

      writeDebug(
        "Opening verification...",
        {
          connect_session_id:
            connectSessionId
        }
      );

      openPayoutKyc({
        url:
          kyc.url,

        connectSessionId,
        flowGeneration,

        isFlowCurrent,

        kycCompletionPendingRef,

        setIsBusy,

        continueAfterKyc,

        writeDebug
      });
    }
    catch (err) {
      if (
        !isFlowCurrent(
          flowGeneration
        )
      ) {
        return;
      }

      if (
        isMissingKycUrlError(
          err
        )
      ) {
        writeDebug(
          "Verification already completed.",
          {
            connect_session_id:
              connectSessionId
          }
        );

        await continueAfterKyc(
          null,
          flowGeneration
        );

        return;
      }

      setIsBusy(
        false
      );

      throw err;
    }
  }

  return {
    createSettlementForIntent,
    createIntentAndSettlement,
    continueAfterKyc,
    startNewFlow
  };
}

export default usePayoutIntentFlow;
