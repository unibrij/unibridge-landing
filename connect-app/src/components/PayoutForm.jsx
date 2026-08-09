// connect-app/src/components/PayoutForm.jsx

import {
  useEffect,
  useMemo
} from "react";

import PricingPreview from "./PricingPreview.jsx";

import TransferFields
  from "./payout-form/TransferFields.jsx";

import BeneficiaryFields
  from "./payout-form/BeneficiaryFields.jsx";

import PayoutLifecyclePanel
  from "./payout-form/PayoutLifecyclePanel.jsx";

import RouteInfo
  from "./payout-form/RouteInfo.jsx";

import useBeneficiaryFields
  from "./payout-form/useBeneficiaryFields.js";

import {
  getRouteAssets,
  getRouteDisplayLabel,
  isComingSoonRoute,
  normalizeArray,
  resolveDisplayStatus
} from "./payout-form/routeUtils.js";

const SHOW_DEBUG =
  import.meta.env.DEV ||
  new URLSearchParams(
    window.location.search
  ).get("debug") === "1";

export default function PayoutForm({
  selectedRouteId,
  selectedRoute,

  form,
  setForm,

  isBusy,
  isReturnedFlow,
  isRepeatFlow,

  settlement,
  fundingTxHash,
  walletConfirmationPending,

  payoutIntentId,
  payoutAttemptState,
  settlementCreationStatus,
  isTransferLocked,
  onNewPayout,

  pricingPreview,
  executionPricing,
  pricingPreviewStatus,
  pricingPreviewError,

  debug,
  handleSend,
  changeRoute,
  updateBeneficiaryField,
  routes
}) {
  const routeUnavailable =
    isComingSoonRoute(
      selectedRoute
    );

  const routeAssets =
    getRouteAssets(
      selectedRoute
    );

  const selectedAsset =
    routeAssets.includes(
      form.asset
    )
      ? form.asset
      : routeAssets[0] ||
        "USDT";

  const selectedNetwork =
    selectedRoute?.network ||
    "polygon";

  /*
   * Transfer-spec controls become immutable at the
   * lifecycle lock boundary.
   */
  const transferFieldsDisabled =
    isTransferLocked ||
    isReturnedFlow ||
    routeUnavailable;

  /*
   * Repeat payouts preserve the source recipient.
   */
  const beneficiaryFieldsDisabled =
    transferFieldsDisabled ||
    isRepeatFlow;

  const routeOptions =
    useMemo(
      () =>
        normalizeArray(
          routes
        )
          .map(route => ({
            value:
              route.id ||
              route.route_id,

            label:
              getRouteDisplayLabel(
                route
              ),

            disabled:
              isComingSoonRoute(
                route
              )
          }))
          .filter(
            option =>
              option.value
          ),
      [
        routes
      ]
    );

  const assetOptions =
    useMemo(
      () =>
        routeAssets.map(
          asset => ({
            value:
              asset,

            label:
              asset,

            asset,

            showAssetIcon:
              true
          })
        ),
      [
        routeAssets
      ]
    );

  /*
   * Normalize only an editable draft to a supported
   * route asset.
   *
   * Existing / locked payouts must never be mutated
   * because the local route catalog changed.
   */
  useEffect(() => {
    if (
      !selectedAsset ||
      transferFieldsDisabled
    ) {
      return;
    }

    if (
      form.asset ===
      selectedAsset
    ) {
      return;
    }

    setForm(
      current => ({
        ...current,

        asset:
          selectedAsset
      })
    );
  }, [
    form.asset,
    selectedAsset,
    setForm,
    transferFieldsDisabled
  ]);

  const {
    renderedFields,
    getOptions,
    updateDynamicField
  } = useBeneficiaryFields({
    selectedRoute,
    form,
    setForm,

    disabled:
      beneficiaryFieldsDisabled
  });

  /*
   * Pricing is required only while creating a new,
   * editable standard payout.
   *
   * Existing and repeat flows continue from their
   * backend-owned context.
   */
  const pricingRequired =
    !isReturnedFlow &&
    !isRepeatFlow &&
    !isTransferLocked &&
    !settlement;

  const pricingUnavailable =
    pricingRequired &&
    (
      pricingPreviewStatus ===
        "loading" ||
      Boolean(
        pricingPreviewError
      ) ||
      !pricingPreview
    );

  const displayedPricing =
    executionPricing ??
    pricingPreview;

  const displayStatus =
    resolveDisplayStatus({
      settlement,
      fundingTxHash,
      walletConfirmationPending,
      routeUnavailable
    });

  return (
    <section className="payout-form">
      <TransferFields
        selectedRouteId={
          selectedRouteId
        }
        routeOptions={
          routeOptions
        }
        form={
          form
        }
        setForm={
          setForm
        }
        selectedAsset={
          selectedAsset
        }
        assetOptions={
          assetOptions
        }
        disabled={
          transferFieldsDisabled
        }
        changeRoute={
          changeRoute
        }
      />

      <BeneficiaryFields
        form={
          form
        }
        renderedFields={
          renderedFields
        }
        getOptions={
          getOptions
        }
        updateDynamicField={
          updateDynamicField
        }
        updateBeneficiaryField={
          updateBeneficiaryField
        }
        disabled={
          beneficiaryFieldsDisabled
        }
      />

      {!routeUnavailable ? (
        <PricingPreview
          pricingPreview={
            displayedPricing
          }
          status={
            executionPricing
              ? "ready"
              : pricingPreviewStatus
          }
          error={
            executionPricing
              ? null
              : pricingPreviewError
          }
        />
      ) : null}

      <PayoutLifecyclePanel
        routeUnavailable={
          routeUnavailable
        }
        isBusy={
          isBusy
        }
        walletConfirmationPending={
          walletConfirmationPending
        }
        settlement={
          settlement
        }
        fundingTxHash={
          fundingTxHash
        }
        payoutAttemptState={
          payoutAttemptState
        }
        settlementCreationStatus={
          settlementCreationStatus
        }
        isTransferLocked={
          isTransferLocked
        }
        pricingUnavailable={
          pricingUnavailable
        }
        handleSend={
          handleSend
        }
        onNewPayout={
          onNewPayout
        }
      />

      <RouteInfo
        selectedNetwork={
          selectedNetwork
        }
        selectedAsset={
          selectedAsset
        }
        payoutIntentId={
          payoutIntentId
        }
        fundingTxHash={
          fundingTxHash
        }
        displayStatus={
          displayStatus
        }
      />

      {SHOW_DEBUG ? (
        <>
          {settlement?.funding ? (
            <pre className="connect-debug">
              {JSON.stringify(
                settlement.funding,
                null,
                2
              )}
            </pre>
          ) : null}

          <pre className="connect-debug">
            {debug}
          </pre>
        </>
      ) : null}
    </section>
  );
}
