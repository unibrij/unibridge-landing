// connect-app/src/hooks/usePayoutIntentFlow.js

import {
  createPayoutIntent,
  createSettlement,
  getPayoutIntent,
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

  authorizeIntentWithWallet,
  ensureIntentAuthorized,
  cancelSettlementPolling,

  writeDebug
}) {
  function requireFlowContext() {
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
    requireFlowContext();

    writeDebug(
      "Creating payout intent...",
      {
        connect_session_id:
          connectSessionId,

        route_id:
          selectedRoute.id ||
          null,

        chain_id:
          chainId ||
          null
      }
    );

    const intentResult =
      await createPayoutIntent({
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

      route_id:
        selectedRoute.id,

      form,

      pricing_preview:
        normalizePricingPreview(
          pricingPreview
        )
    });

    writeDebug(
      "Payout intent created.",
      {
        payout_intent_id:
          intentId
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
      "Verification completed. Creating payout intent..."
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

    if (!selectedRoute) {
      writeDebug(
        "Select a payout route first."
      );

      return;
    }

    const normalizedPricingPreview =
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
            selectedRoute.id ||
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
     * Do not delete the previous payout access token.
     * Historical transfers still need their token for
     * authenticated receipt downloads.
     */

    storeFlowSnapshot({
      connect_session_id:
        connectSessionId,

      payout_intent_id:
        null,

      route_id:
        selectedRoute.id,

      form,

      pricing_preview:
        normalizedPricingPreview
    });

    writeDebug(
      "Starting verification...",
      {
        connect_session_id:
          connectSessionId,

        route_id:
          selectedRoute.id ||
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
