// connect-app/src/hooks/usePayoutIntentFlow.js

import {
  createPayoutIntent,
  createSettlement,
  getPayoutIntent,
  repeatPayout,
  startKyc
} from "../api";

import {
  validateRouteForm
} from "../form";

import {
  clearStoredPayoutIntent,
  readStoredFlow,
  storeFlowSnapshot
} from "../flow/flowStorage";

import {
  PAYOUT_ATTEMPT_STATE,
  buildTransferFingerprint,
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

export function usePayoutIntentFlow({
  isConnected,
  address,
  chainId,
  connectSessionId,
  selectedRoute,
  form,
  pricingPreview,

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
}) {
  const isRepeatFlow =
    Boolean(
      repeatSourcePayoutIntentId
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

  function normalizeAuthorizationStatus(
    value
  ) {
    return String(
      value ||
      ""
    )
      .trim()
      .toLowerCase();
  }

  function requireNormalFlowContext() {
    if (!connectSessionId) {
      throw new Error(
        "connect_session_required"
      );
    }

    if (!selectedRoute) {
      throw new Error(
        "connect_route_required"
      );
    }

    if (!address) {
      throw new Error(
        "wallet_address_required"
      );
    }

    validateRouteForm({
      form,

      route:
        selectedRoute
    });
  }

  function requireRepeatFlowContext() {
    if (!connectSessionId) {
      throw new Error(
        "connect_session_required"
      );
    }

    if (
      !repeatSourcePayoutIntentId
    ) {
      throw new Error(
        "repeat_source_payout_intent_id_required"
      );
    }

    if (!repeatAccessToken) {
      throw new Error(
        "repeat_access_token_required"
      );
    }

    const amount =
      Number(
        form?.amount
      );

    if (
      !Number.isFinite(
        amount
      ) ||
      amount <= 0
    ) {
      throw new Error(
        "invalid_amount"
      );
    }
  }

  function buildCurrentTransferFingerprint() {
    return buildTransferFingerprint({
      route:
        selectedRoute,

      form,

      repeatSourcePayoutIntentId:
        repeatSourcePayoutIntentId ||
        null
    });
  }

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

      /*
       * New payout may have detached this attempt
       * while settlement creation was pending.
       */
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
    catch (
      err
    ) {
      /*
       * Once the user detached this flow, its
       * lifecycle result must not affect the new
       * frontend payout.
       */
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
      catch (
        lifecycleError
      ) {
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

  async function createIntentAndSettlement(
    flowGeneration =
      getFlowGeneration()
  ) {
    if (isRepeatFlow) {
      requireRepeatFlowContext();
    }
    else {
      requireNormalFlowContext();
    }

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

            form
          });

    /*
     * The user may have pressed New payout while
     * intent creation was pending.
     *
     * Never attach the resulting old intent to the
     * new frontend draft.
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

    const transferFingerprint =
      buildCurrentTransferFingerprint();

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
        transferFingerprint,

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

      const settlementResult =
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

        settlement:
          settlementResult
      };
    }
    catch (
      err
    ) {
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
           * Keep the intent when authoritative
           * lifecycle cannot be determined.
           */
        }
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
    catch (
      err
    ) {
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

  async function continueAfterKyc(
    suppliedIntentId,
    flowGeneration =
      getFlowGeneration()
  ) {
    setIsBusy(
      true
    );

    /*
     * setPayoutIntentId() is asynchronous.
     *
     * Only an explicitly supplied id or the mutable
     * ref may resume an existing attempt here.
     * Do not revive an intent from a stale render
     * value after it was detached locally.
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

      const currentFingerprint =
        buildCurrentTransferFingerprint();

      const staleIntent =
        isStalePreCommitIntent({
          intent:
            existingIntent,

          storedFingerprint:
            storedFlow
              ?.transfer_fingerprint,

          currentFingerprint
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

    /*
     * Inspect an existing attempt before deciding
     * whether Continue should resume it or safely
     * replace a completed pre-creation authorization.
     */
    const existingIntentId =
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
        return;
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
        /*
         * Safe failed pre-side-effect attempt was
         * detached. Continue below and create a
         * replacement attempt.
         */
      }
      else if (
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
      else if (
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
      else if (
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
      else {
        const authorizationStatus =
          normalizeAuthorizationStatus(
            existingIntent
              ?.authorization_status
          );

        /*
         * An unsigned editable intent may simply
         * be waiting for wallet confirmation.
         *
         * Keep the same intent so pressing Continue
         * again can reopen its wallet signature.
         */
        if (
          attemptState ===
            PAYOUT_ATTEMPT_STATE
              .EDITABLE &&
          authorizationStatus !==
            "signed"
        ) {
          return continueExistingIntent(
            existingIntentId,
            existingIntent,
            flowGeneration
          );
        }

        /*
         * A signed editable/pre-creation intent is
         * still before settlement side effects.
         *
         * Validate the replacement draft BEFORE
         * detaching this intent. If pricing or form
         * validation is not ready, keep the existing
         * attempt attached.
         */
        if (
          attemptState ===
            PAYOUT_ATTEMPT_STATE
              .EDITABLE
        ) {
          if (isRepeatFlow) {
            requireRepeatFlowContext();
          }
          else {
            const normalizedPricingPreview =
              normalizePricingPreview(
                pricingPreview
              );

            if (
              !normalizedPricingPreview
            ) {
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

            validateRouteForm({
              form,

              route:
                selectedRoute
            });
          }

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
      }
    }

    let normalizedPricingPreview =
      null;

    if (isRepeatFlow) {
      requireRepeatFlowContext();
    }
    else {
      normalizedPricingPreview =
        normalizePricingPreview(
          pricingPreview
        );

      if (
        !normalizedPricingPreview
      ) {
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

      validateRouteForm({
        form,

        route:
          selectedRoute
      });
    }

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

    writeDebug(
      "Starting verification...",
      {
        connect_session_id:
          connectSessionId,

        route_id:
          selectedRoute?.id ||
          null,

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

      window.location.assign(
        kyc.url
      );
    }
    catch (
      err
    ) {
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
