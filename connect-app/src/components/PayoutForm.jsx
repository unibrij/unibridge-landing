// connect-app/src/components/PayoutForm.jsx

import {
  useEffect,
  useMemo,
  useState
} from "react";

import Select from "./payout-form/Select.jsx";
import SearchableSelect from "./payout-form/SearchableSelect.jsx";
import RouteInfo from "./payout-form/RouteInfo.jsx";

import {
  DYNAMIC_OPTION_ENDPOINTS,
  filterFieldOptions,
  normalizeDynamicOptions
} from "./payout-form/dynamicOptions.js";

import {
  getBeneficiaryFields,
  getRouteAssets,
  getRouteDisplayLabel,
  isComingSoonRoute,
  normalizeArray,
  resolveButtonLabel,
  resolveDisplayStatus
} from "./payout-form/routeUtils.js";

const SHOW_DEBUG =
  import.meta.env.DEV ||
  new URLSearchParams(window.location.search).get("debug") === "1";

function hasOwn(value = {}, key) {
  return Object.prototype.hasOwnProperty.call(
    value,
    key
  );
}

export default function PayoutForm({
  selectedRouteId,
  selectedRoute,
  form,
  setForm,
  isBusy,
  isReturnedFlow,
  settlement,
  fundingTxHash,
  walletConfirmationPending,
  payoutIntentId,
  debug,
  handleSend,
  changeRoute,
  updateBeneficiaryField,
  routes
}) {
  const [dynamicOptionSources, setDynamicOptionSources] =
    useState({});

  const routeUnavailable =
    isComingSoonRoute(selectedRoute);

  const routeAssets =
    getRouteAssets(selectedRoute);

  const beneficiaryFields =
    getBeneficiaryFields(selectedRoute);

  const selectedAsset =
    routeAssets.includes(form.asset)
      ? form.asset
      : routeAssets[0] || "USDT";

  const selectedNetwork =
    selectedRoute?.network || "polygon";

  const routeOptions =
    useMemo(
      () =>
        normalizeArray(routes)
          .map(route => ({
            value:
              route.id || route.route_id,

            label:
              getRouteDisplayLabel(route),

            disabled:
              isComingSoonRoute(route)
          }))
          .filter(option => option.value),
      [routes]
    );

  const assetOptions =
    useMemo(
      () =>
        routeAssets.map(asset => ({
          value: asset,
          label: asset
        })),
      [routeAssets]
    );

  const dynamicSources =
    useMemo(
      () =>
        Array.from(
          new Set(
            beneficiaryFields
              .map(field => field?.source)
              .filter(source => DYNAMIC_OPTION_ENDPOINTS[source])
          )
        ),
      [beneficiaryFields]
    );

  useEffect(() => {
    if (dynamicSources.length === 0) return;

    let cancelled = false;

    async function loadDynamicSources() {
      const missingSources =
        dynamicSources.filter(source =>
          !hasOwn(dynamicOptionSources, source)
        );

      if (missingSources.length === 0) {
        return;
      }

      await Promise.all(
        missingSources.map(async source => {
          const endpoint =
            DYNAMIC_OPTION_ENDPOINTS[source];

          try {
            const response =
              await fetch(endpoint);

            if (!response.ok) {
              throw new Error(`options_${source}_failed`);
            }

            const payload =
              await response.json();

            const options =
              normalizeDynamicOptions(payload);

            console.log("CONNECT_DYNAMIC_OPTIONS_LOADED", {
              source,
              endpoint,
              payload,
              optionsLength:
                options.length,
              sample:
                options.slice(0, 3)
            });

            if (cancelled) return;

            setDynamicOptionSources(current => ({
              ...current,
              [source]:
                options
            }));
          } catch (err) {
            console.warn(
              "CONNECT_DYNAMIC_OPTIONS_FAILED",
              source,
              err?.message || String(err)
            );

            if (cancelled) return;

            setDynamicOptionSources(current => ({
              ...current,
              [source]:
                []
            }));
          }
        })
      );
    }

    loadDynamicSources();

    return () => {
      cancelled = true;
    };
  }, [
    dynamicSources,
    dynamicOptionSources
  ]);

  useEffect(() => {
    if (!selectedAsset) return;
    if (form.asset === selectedAsset) return;

    setForm(current => ({
      ...current,
      asset: selectedAsset
    }));
  }, [
    form.asset,
    selectedAsset,
    setForm
  ]);

  const displayStatus =
    resolveDisplayStatus({
      settlement,
      fundingTxHash,
      walletConfirmationPending,
      routeUnavailable
    });

  const buttonLabel =
    resolveButtonLabel({
      isBusy,
      settlement,
      walletConfirmationPending,
      routeUnavailable
    });

  return (
    <section className="payout-form">
      <label>
        Route

        <Select
          value={selectedRouteId}
          options={routeOptions}
          disabled={isBusy || isReturnedFlow}
          ariaLabel="Select payout route"
          onChange={changeRoute}
        />
      </label>

      <label>
        Amount
        <input
          type="number"
          min="1"
          placeholder="100"
          value={form.amount}
          disabled={
            isBusy ||
            isReturnedFlow ||
            routeUnavailable
          }
          onChange={e =>
            setForm({
              ...form,
              amount: e.target.value
            })
          }
        />
      </label>

      <label>
        Asset

        <Select
          value={selectedAsset}
          options={assetOptions}
          disabled={
            isBusy ||
            isReturnedFlow ||
            routeUnavailable
          }
          ariaLabel="Select funding asset"
          onChange={asset =>
            setForm({
              ...form,
              asset
            })
          }
        />
      </label>

      {beneficiaryFields.map(field => {
        const fieldName =
          field.name;

        if (
          field.type === "select" &&
          field.source
        ) {
          const rawOptions =
            dynamicOptionSources[field.source];

          const options =
            filterFieldOptions({
              field,
              options:
                rawOptions,
              selectedRoute
            });

          console.log("CONNECT_FIELD_OPTIONS", {
            field,
            source:
              field.source,
            rawOptionsLength:
              normalizeArray(rawOptions).length,
            filteredOptionsLength:
              options.length,
            sample:
              options.slice(0, 3),
            selectedRoute
          });

          return (
            <label key={fieldName}>
              {field.label}

              <SearchableSelect
                value={form.beneficiary?.[fieldName] || ""}
                options={options}
                disabled={
                  isBusy ||
                  isReturnedFlow ||
                  routeUnavailable
                }
                ariaLabel={`Search ${field.label}`}
                placeholder="Search bank or wallet"
                onChange={value =>
                  updateBeneficiaryField(
                    fieldName,
                    value
                  )
                }
              />
            </label>
          );
        }

        return (
          <label key={fieldName}>
            {field.label}
            <input
              type={field.type || "text"}
              placeholder={field.placeholder}
              required={field.required}
              disabled={
                isBusy ||
                isReturnedFlow ||
                routeUnavailable
              }
              value={form.beneficiary?.[fieldName] || ""}
              onChange={e =>
                updateBeneficiaryField(
                  fieldName,
                  e.target.value
                )
              }
            />
          </label>
        );
      })}

      {routeUnavailable ? (
        <div className="wallet-pending-card">
          <strong>Coming soon</strong>
          <span>
            This payout corridor is not available yet.
          </span>
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleSend}
        disabled={
          routeUnavailable ||
          (isBusy && !walletConfirmationPending)
        }
      >
        {buttonLabel}
      </button>

      {walletConfirmationPending && !fundingTxHash ? (
        <div className="wallet-pending-card">
          <strong>Wallet confirmation pending</strong>
          <span>
            Return to your wallet and confirm the transaction.
          </span>
        </div>
      ) : null}

      <RouteInfo
        selectedNetwork={selectedNetwork}
        selectedAsset={selectedAsset}
        payoutIntentId={payoutIntentId}
        fundingTxHash={fundingTxHash}
        displayStatus={displayStatus}
      />

      {SHOW_DEBUG ? (
        <>
          {settlement?.funding ? (
            <pre className="connect-debug">
              {JSON.stringify(settlement.funding, null, 2)}
            </pre>
          ) : null}

          <pre className="connect-debug">{debug}</pre>
        </>
      ) : null}
    </section>
  );
}
