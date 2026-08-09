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
}) {
  const isRepeatFlow =
    Boolean(
      repeatSourcePayoutIntentId
    );

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

    /*
     * Product attempt boundary:
     *
     * FAILED + EDITABLE means the Core confirms
     * settlement creation failed before crossing
     * the unsafe external side-effect boundary.
     *
     * The product ends that attempt here instead of
     * keeping the user attached to the failed intent.
     */
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
    intentId
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
       * Do not infer lifecycle from the HTTP failure.
       *
       * Read the authoritative Core state produced
       * by this settlement-creation attempt.
       */
      try {
        const latestIntent =
          await getPayoutIntent({
            payoutIntentId:
              intentId
          });

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
        /*
         * If the authoritative lifecycle cannot be
         * read, do not clear the intent blindly.
         *
         * We cannot prove that it failed before the
         * side-effect boundary.
         */
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

  async function createIntentAndSettlement() {
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

      const settlementResult =
        await createSettlementForIntent(
          intentId
        );

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
      /*
       * createSettlementForIntent() handles settlement
       * lifecycle decisions itself.
       *
       * If authorization failed before settlement
       * creation ever started, the intent is disposable.
       */
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
    existingIntent = null
  ) {
    const resolvedIntent =
      existingIntent ||
      await getPayoutIntent({
        payoutIntentId:
          intentId
      });

    const attemptState =
      resolvePayoutAttemptState(
        resolvedIntent
      );

    const creationStatus =
      resolveSettlementCreationStatus(
        resolvedIntent
      );

    /*
     * Safe failure:
     * this product attempt is over.
     */
    if (
      await retireSafeFailedIntent(
        intentId,
        resolvedIntent
      )
    ) {
      return null;
    }

    /*
     * Unsafe failure:
     * preserve the intent and require recovery.
     */
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

    /*
     * Creation is already running.
     *
     * Keep the same intent and keep the form locked,
     * but do not call createSettlement again while
     * the backend lease is active.
     */
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
    }
    catch (
      err
    ) {
      /*
       * Before settlement creation has begun, an
       * authorization failure ends this attempt.
       *
       * Locked/resumable attempts are preserved.
       */
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

    /*
     * At this point:
     *
     * - editable pre-creation intent may create
     *   settlement for the first time
     *
     * - ready intent may call createSettlement
     *   idempotently and receive the existing
     *   settlement
     */
    return createSettlementForIntent(
      intentId
    );
  }

  async function continueAfterKyc(
    suppliedIntentId
  ) {
    setIsBusy(
      true
    );

    const existingIntentId =
      suppliedIntentId ||
      payoutIntentIdRef.current ||
      payoutIntentId ||
      null;

    if (existingIntentId) {
      const existingIntent =
        await getPayoutIntent({
          payoutIntentId:
            existingIntentId
        });

      const attemptState =
        resolvePayoutAttemptState(
          existingIntent
        );

      const creationStatus =
        resolveSettlementCreationStatus(
          existingIntent
        );

      /*
       * SAFE FAILED ATTEMPT:
       *
       * End the old attempt immediately.
       * Same data or different data does not matter.
       */
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
          await createIntentAndSettlement();

        return result.settlement;
      }

      /*
       * CREATING:
       *
       * Existing attempt owns the transfer
       * specification, so it remains locked.
       *
       * Do not invoke createSettlement again while
       * creation is already in progress.
       */
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

      /*
       * LOCKED / RECOVERY:
       *
       * Preserve the current payout intent.
       */
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

      /*
       * LOCKED / RESUMABLE:
       *
       * At this point "creating" has already been
       * handled above, so this is effectively READY.
       *
       * Reuse the same intent. Backend createSettlement
       * returns the existing settlement idempotently.
       */
      if (
        attemptState ===
        PAYOUT_ATTEMPT_STATE
          .LOCKED_RESUMABLE
      ) {
        return continueExistingIntent(
          existingIntentId,
          existingIntent
        );
      }

      /*
       * EDITABLE and not previously failed:
       *
       * The same active pre-creation intent may be
       * reused only if the transfer specification
       * still matches.
       */
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
          existingIntent
        );
      }
    }

    writeDebug(
      isRepeatFlow
        ? "Verification completed. Creating repeated payout intent..."
        : "Verification completed. Creating payout intent..."
    );

    const result =
      await createIntentAndSettlement();

    return result.settlement;
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

    /*
     * Never discard an existing attempt before
     * asking the Core what lifecycle state it is in.
     */
    const existingIntentId =
      payoutIntentIdRef.current ||
      payoutIntentId ||
      null;

    if (existingIntentId) {
      return continueAfterKyc(
        existingIntentId
      );
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
          null
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
          null
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
