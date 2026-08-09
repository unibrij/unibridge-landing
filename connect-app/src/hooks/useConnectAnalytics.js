// connect-app/src/hooks/useConnectAnalytics.js

import {
  useCallback,
  useEffect,
  useRef
} from "react";

import {
  trackConnectEvent
} from "../analytics/trackConnectEvent.js";

export default function useConnectAnalytics({
  isHistoryPage,

  isConnected,
  address,
  chainId,

  selectedRouteId,
  asset,

  isReturnedFlow,
  isRepeatFlow,

  settlement,
  payoutIntentId,
  repeatSourcePayoutIntentId
}) {
  const pageViewTrackedRef =
    useRef(false);

  const walletConnectedTrackedRef =
    useRef(false);

  const routeCreatedTrackedRef =
    useRef(false);

  /*
   * Page view.
   *
   * Connect tracks this once per mounted app session.
   */
  useEffect(() => {
    if (
      isHistoryPage ||
      pageViewTrackedRef.current
    ) {
      return;
    }

    pageViewTrackedRef.current =
      true;

    trackConnectEvent(
      "page_view",
      {
        route_id:
          selectedRouteId,

        asset,

        metadata: {
          returned_flow:
            isReturnedFlow,

          repeat_flow:
            isRepeatFlow
        }
      }
    );
  }, [
    asset,
    isHistoryPage,
    isRepeatFlow,
    isReturnedFlow,
    selectedRouteId
  ]);

  /*
   * Wallet connection.
   *
   * Track the first usable connected wallet only.
   */
  useEffect(() => {
    if (
      isHistoryPage ||
      !isConnected ||
      !address ||
      walletConnectedTrackedRef
        .current
    ) {
      return;
    }

    walletConnectedTrackedRef.current =
      true;

    trackConnectEvent(
      "wallet_connected",
      {
        wallet_address:
          address,

        route_id:
          selectedRouteId,

        asset,

        metadata: {
          chain_id:
            chainId
        }
      }
    );
  }, [
    address,
    asset,
    chainId,
    isConnected,
    isHistoryPage,
    selectedRouteId
  ]);

  /*
   * A settlement becoming available means the
   * payout route was created successfully.
   *
   * Track once until the parent explicitly resets
   * route-created tracking for a new payout.
   */
  useEffect(() => {
    if (
      isHistoryPage ||
      !settlement ||
      routeCreatedTrackedRef
        .current
    ) {
      return;
    }

    routeCreatedTrackedRef.current =
      true;

    trackConnectEvent(
      "route_created",
      {
        wallet_address:
          address,

        route_id:
          selectedRouteId,

        asset,

        metadata: {
          settlement_id:
            settlement
              ?.settlement_id ||
            settlement?.id ||
            null,

          payout_intent_id:
            payoutIntentId,

          repeat_source_payout_intent_id:
            repeatSourcePayoutIntentId
        }
      }
    );
  }, [
    address,
    asset,
    isHistoryPage,
    payoutIntentId,
    repeatSourcePayoutIntentId,
    selectedRouteId,
    settlement
  ]);

  const trackWalletConnectStarted =
    useCallback(
      () => {
        return trackConnectEvent(
          "wallet_connect_started",
          {
            route_id:
              selectedRouteId,

            asset
          }
        );
      },
      [
        asset,
        selectedRouteId
      ]
    );

  const trackRouteStarted =
    useCallback(
      ({
        amount
      }) => {
        return trackConnectEvent(
          "route_started",
          {
            wallet_address:
              address,

            route_id:
              selectedRouteId,

            asset,

            metadata: {
              amount,

              payout_intent_id:
                payoutIntentId,

              repeat_source_payout_intent_id:
                repeatSourcePayoutIntentId
            }
          }
        );
      },
      [
        address,
        asset,
        payoutIntentId,
        repeatSourcePayoutIntentId,
        selectedRouteId
      ]
    );

  const trackInstallClicked =
    useCallback(
      ({
        hasInstallPrompt
      }) => {
        return trackConnectEvent(
          "add_to_home_screen_clicked",
          {
            wallet_address:
              address,

            route_id:
              selectedRouteId,

            asset,

            metadata: {
              has_install_prompt:
                Boolean(
                  hasInstallPrompt
                )
            }
          }
        );
      },
      [
        address,
        asset,
        selectedRouteId
      ]
    );

  const resetRouteCreatedTracking =
    useCallback(
      () => {
        routeCreatedTrackedRef.current =
          false;
      },
      []
    );

  return {
    trackWalletConnectStarted,
    trackRouteStarted,
    trackInstallClicked,

    resetRouteCreatedTracking
  };
}
