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


function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}


function formatReceiveRail(
  value
) {
  return normalizeString(
    value
  )
    .replace(
      /_/g,
      " "
    )
    .toUpperCase();
}


export default function PayoutForm({
  selectedRouteId,
  selectedRoute,

  form,
  setForm,

  isBusy,
  isReturnedFlow,
  isRepeatFlow,

  receiveBound = false,
  receiveDestinationCountry = null,
  receivePayoutRail = null,
  receiveRecipient = null,

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
  /*
   * selectedRoute is intentionally nullable.
   *
   * Standard normally resolves synchronously to a
   * selectable fallback route, while Receive remains
   * fail-closed when its exact bound route is not
   * available.
   *
   * Either way, a missing route must be treated as
   * unavailable and must never flow into route logic
   * as though a valid route exists.
   */
  const routeUnavailable =
    !selectedRoute ||
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
   * Amount / asset remain editable for Receive.
   *
   * Receive fixes the destination, not the transfer
   * amount or funding asset.
   */
  const transferFieldsDisabled =
    isTransferLocked ||
    isReturnedFlow ||
    routeUnavailable;

  /*
   * Repeat and Receive never allow browser-side
   * beneficiary mutation.
   */
  const beneficiaryFieldsDisabled =
    transferFieldsDisabled ||
    isRepeatFlow ||
    receiveBound;

  /*
   * Build the ordinary route catalog first.
   *
   * Receive then exposes only its already-resolved
   * route to TransferFields. This keeps destination
   * selection fixed without disabling amount/asset.
   */
  const routeOptions =
    useMemo(
      () => {
        const options =
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
            );

        if (!receiveBound) {
          return options;
        }

        const receiveRouteId =
          normalizeString(
            selectedRouteId
          );

        if (!receiveRouteId) {
          return [];
        }

        return options.filter(
          option =>
            normalizeString(
              option.value
            ) ===
            receiveRouteId
        );
      },
      [
        receiveBound,
        routes,
        selectedRouteId
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
   * Browser-safe Receive presentation.
   *
   * Only masked metadata from Receive context is
   * rendered here. Raw beneficiary data is never
   * expected in this component.
   */
  const receiveRecipientLabel =
    normalizeString(
      receiveRecipient?.label
    );

  const receiveMaskedIdentifier =
    normalizeString(
      receiveRecipient
        ?.masked_identifier
    );

  const receiveCountryLabel =
    normalizeString(
      receiveDestinationCountry
    ).toUpperCase();

  const receiveRailLabel =
    formatReceiveRail(
      receivePayoutRail
    );

  const receiveRecipientSummary =
    [
      receiveRecipientLabel,
      receiveMaskedIdentifier
    ]
      .filter(Boolean)
      .join(
        " · "
      );

  const receiveDestinationSummary =
    [
      receiveCountryLabel,
      receiveRailLabel
    ]
      .filter(Boolean)
      .join(
        " · "
      );

  /*
   * Pricing is required while creating a new,
   * editable Standard or Receive payout.
   *
   * Existing and Repeat flows continue from their
   * backend-owned execution context.
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
      {receiveBound ? (
        <div
          className="wallet-pending-card receive-destination-summary"
          aria-label="Receive destination"
        >
          <strong>
            {receiveRecipientSummary ||
              "Recipient"}
          </strong>

          <span>
            {receiveDestinationSummary ||
              "Destination fixed by recipient"}
          </span>
        </div>
      ) : null}

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

      {!receiveBound ? (
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
