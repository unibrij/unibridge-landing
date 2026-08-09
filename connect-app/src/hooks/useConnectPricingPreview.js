// connect-app/src/hooks/useConnectPricingPreview.js

import {
  useCallback,
  useEffect,
  useState
} from "react";

import {
  previewConnectRoute
} from "../api.js";

function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}

export default function useConnectPricingPreview({
  enabled,

  isConnected,
  address,
  connectSessionId,

  selectedRoute,

  amount,
  asset
}) {
  const [
    pricingPreview,
    setPricingPreview
  ] = useState(null);

  const [
    pricingPreviewStatus,
    setPricingPreviewStatus
  ] = useState("idle");

  const [
    pricingPreviewError,
    setPricingPreviewError
  ] = useState(null);

  const resetPricingPreview =
    useCallback(
      () => {
        setPricingPreview(
          null
        );

        setPricingPreviewStatus(
          "idle"
        );

        setPricingPreviewError(
          null
        );
      },
      []
    );

  useEffect(() => {
    let cancelled =
      false;

    const normalizedAmount =
      normalizeString(
        amount
      );

    const numericAmount =
      Number(
        normalizedAmount
      );

    const canLoadPreview =
      enabled &&
      isConnected &&
      Boolean(
        address
      ) &&
      Boolean(
        connectSessionId
      ) &&
      Boolean(
        selectedRoute
      ) &&
      Boolean(
        asset
      ) &&
      normalizedAmount !==
        "" &&
      Number.isFinite(
        numericAmount
      ) &&
      numericAmount > 0;

    /*
     * No valid editable pricing context.
     *
     * Keep the hook in a clean idle state rather
     * than preserving stale pricing from a previous
     * transfer specification.
     */
    if (!canLoadPreview) {
      setPricingPreview(
        null
      );

      setPricingPreviewStatus(
        "idle"
      );

      setPricingPreviewError(
        null
      );

      return undefined;
    }

    /*
     * A new transfer specification invalidates the
     * previous preview immediately.
     */
    setPricingPreview(
      null
    );

    setPricingPreviewStatus(
      "loading"
    );

    setPricingPreviewError(
      null
    );

    const timeoutId =
      window.setTimeout(
        async () => {
          try {
            const response =
              await previewConnectRoute({
                connectSessionId,

                walletAddress:
                  address,

                route:
                  selectedRoute,

                amount:
                  normalizedAmount,

                asset
              });

            if (cancelled) {
              return;
            }

            setPricingPreview(
              response
                ?.pricing_preview ??
              null
            );

            setPricingPreviewStatus(
              "ready"
            );

            setPricingPreviewError(
              null
            );
          }
          catch (
            error
          ) {
            if (cancelled) {
              return;
            }

            setPricingPreview(
              null
            );

            setPricingPreviewStatus(
              "error"
            );

            setPricingPreviewError(
              error?.message ||
              "connect_pricing_preview_failed"
            );
          }
        },
        300
      );

    return () => {
      cancelled =
        true;

      window.clearTimeout(
        timeoutId
      );
    };
  }, [
    address,
    amount,
    asset,
    connectSessionId,
    enabled,
    isConnected,
    selectedRoute
  ]);

  return {
    pricingPreview,
    pricingPreviewStatus,
    pricingPreviewError,

    resetPricingPreview
  };
}
