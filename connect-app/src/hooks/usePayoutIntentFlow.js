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
  storeFlowSnapshot
} from "../flow/flowStorage";

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

  async function continueExistingIntent(
    intentId
  ) {
    const existingIntent =
      await getPayoutIntent({
        payoutIntentId:
          intentId
      });

    await ensureIntentAuthorized({
      intentId,

      authorizationStatus:
        existingIntent
          ?.authorization_status
    });

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
      return continueExistingIntent(
        existingIntentId
      );
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

    /*
     * Do not delete previous payout access tokens.
     * Historical transfers still need them for authenticated
     * receipt downloads and Repeat may still need the source
     * flow token until the new intent exists.
     */

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
