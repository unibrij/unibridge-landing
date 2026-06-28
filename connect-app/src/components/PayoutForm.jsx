// connect-app/src/components/PayoutForm.jsx

import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

const SHOW_DEBUG =
  import.meta.env.DEV ||
  new URLSearchParams(window.location.search).get("debug") === "1";

const DYNAMIC_OPTION_ENDPOINTS = {
  coinsph_ph_payout_channels:
    "/surface/options/coinsph/ph-payout-channels"
};

function shortId(value = "") {
  const text =
    String(value || "").trim();

  if (!text) return "—";
  if (text.length <= 20) return text;

  return `${text.slice(0, 10)}...${text.slice(-6)}`;
}

async function copyToClipboard(value) {
  const text =
    String(value || "").trim();

  if (!text) return;

  await navigator.clipboard.writeText(text);
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeUpper(value) {
  return normalizeString(value).toUpperCase();
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function uniqueValues(values = []) {
  return Array.from(
    new Set(
      values
        .map(value => String(value || "").trim().toUpperCase())
        .filter(Boolean)
    )
  );
}

function isComingSoonRoute(route = {}) {
  return Boolean(
    route.comingSoon ||
      route.coming_soon ||
      route.disabled ||
      route.status === "coming_soon"
  );
}

function isBrazilRoute(route = {}) {
  const id =
    String(route.id || route.route_id || "").toLowerCase();

  const label =
    String(route.label || route.name || "").toLowerCase();

  const country =
    String(
      route.destination_country ||
        route.destinationCountry ||
        route.country ||
        ""
    ).toUpperCase();

  return (
    country === "BR" ||
    id.includes("br") ||
    label.includes("brazil") ||
    label.includes("pix")
  );
}

function isPhilippinesRoute(route = {}) {
  const id =
    String(route.id || route.route_id || "").toLowerCase();

  const label =
    String(route.label || route.name || "").toLowerCase();

  const country =
    String(
      route.destination_country ||
        route.destinationCountry ||
        route.country ||
        ""
    ).toUpperCase();

  return (
    country === "PH" ||
    id.includes("ph") ||
    label.includes("philippines") ||
    label.includes("gcash") ||
    label.includes("instapay") ||
    label.includes("pesonet")
  );
}

function getRouteAssets(route = {}) {
  const backendAssets =
    normalizeArray(route.assets);

  const baseAssets =
    backendAssets.length > 0
      ? backendAssets
      : route.asset
        ? [route.asset]
        : ["USDT"];

  if (isBrazilRoute(route)) {
    return uniqueValues([
      ...baseAssets,
      "USDT",
      "USDC"
    ]);
  }

  return uniqueValues(baseAssets);
}

function getBeneficiaryFields(route = {}) {
  if (isComingSoonRoute(route)) {
    return [];
  }

  return normalizeArray(route.beneficiaryFields);
}

function getRouteFlag(route = {}) {
  const country =
    normalizeUpper(route.country);

  if (isBrazilRoute(route)) return "🇧🇷";
  if (isPhilippinesRoute(route)) return "🇵🇭";
  if (country === "MX") return "🇲🇽";
  if (country === "IN") return "🇮🇳";
  if (country === "NG") return "🇳🇬";

  return "🌐";
}

function getRouteDisplayLabel(route = {}) {
  return `${getRouteFlag(route)} ${route.label || route.name || route.id || "Route"}`;
}

function getNetworkDisplayName(network = "") {
  const value =
    String(network || "").trim().toLowerCase();

  if (value === "polygon") return "Polygon";

  return network || "Network";
}

function resolveRouteChannelName(route = {}) {
  return normalizeUpper(
    route.channelName ||
      route.channel_name ||
      route.transactionChannel ||
      route.transaction_channel
  );
}

function resolveOptionValue(option = {}, field = {}) {
  return normalizeString(
    option?.[field.value_field] ||
      option?.value ||
      option?.transactionSubject ||
      option?.transaction_subject ||
      option?.channelSubject ||
      option?.channel_subject ||
      option?.id
  );
}

function resolveOptionLabel(option = {}, field = {}) {
  return normalizeString(
    option?.[field.label_field] ||
      option?.label ||
      option?.transactionSubjectName ||
      option?.transaction_subject_name ||
      option?.name ||
      resolveOptionValue(option, field)
  );
}

function resolveOptionChannel(option = {}, field = {}) {
  return normalizeUpper(
    option?.[field.channel_field] ||
      option?.transactionChannel ||
      option?.transaction_channel ||
      option?.channelName ||
      option?.channel_name
  );
}

function normalizeDynamicOptions(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  const data =
    normalizeArray(payload?.data);

  if (data.length > 0) {
    return data;
  }

  const channels =
    normalizeArray(payload?.channels);

  if (channels.length > 0) {
    return channels;
  }

  const options =
    normalizeArray(payload?.options);

  if (options.length > 0) {
    return options;
  }

  return [];
}

function filterFieldOptions({
  field = {},
  options = [],
  selectedRoute = {}
}) {
  const routeChannel =
    resolveRouteChannelName(selectedRoute);

  return normalizeArray(options)
    .filter(option => {
      const status =
        option?.status;

      if (
        status !== undefined &&
        status !== null &&
        String(status).trim() !== "1"
      ) {
        return false;
      }

      const optionChannel =
        resolveOptionChannel(option, field);

      if (
        routeChannel &&
        optionChannel &&
        optionChannel !== routeChannel
      ) {
        return false;
      }

      return Boolean(
        resolveOptionValue(option, field)
      );
    })
    .map(option => ({
      value:
        resolveOptionValue(option, field),
      label:
        resolveOptionLabel(option, field)
    }));
}

function PolygonIcon() {
  return (
    <span
      className="network-icon polygon-network-icon"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 38.4 33.5"
        width="17"
        height="17"
        focusable="false"
      >
        <path
          fill="#8247E5"
          d="M29 10.2c-.7-.4-1.6-.4-2.4 0L21 13.5l-3.8 2.1-5.6 3.3c-.7.4-1.6.4-2.4 0l-4.4-2.6c-.7-.4-1.2-1.2-1.2-2.1V9.1c0-.8.4-1.6 1.2-2.1l4.4-2.5c.7-.4 1.6-.4 2.4 0L16 7.1c.7.4 1.2 1.2 1.2 2.1v3.3l3.8-2.2V7c0-.8-.4-1.6-1.2-2.1L11.6.2c-.7-.4-1.6-.4-2.4 0L1.2 4.9C.4 5.3 0 6.1 0 7v9.3c0 .8.4 1.6 1.2 2.1l8.1 4.7c.7.4 1.6.4 2.4 0l5.6-3.2 3.8-2.2 5.6-3.2c.7-.4 1.6-.4 2.4 0l4.4 2.5c.7.4 1.2 1.2 1.2 2.1v5.1c0 .8-.4 1.6-1.2 2.1l-4.4 2.5c-.7.4-1.6.4-2.4 0l-4.4-2.5c-.7-.4-1.2-1.2-1.2-2.1v-3.3l-3.8 2.2v3.3c0 .8.4 1.6 1.2 2.1l8.1 4.7c.7.4 1.6.4 2.4 0l8.1-4.7c.7-.4 1.2-1.2 1.2-2.1v-9.3c0-.8-.4-1.6-1.2-2.1L29 10.2z"
        />
      </svg>
    </span>
  );
}

function resolveDisplayStatus({
  settlement,
  fundingTxHash,
  walletConfirmationPending,
  routeUnavailable
}) {
  if (routeUnavailable) return "Coming soon";
  if (fundingTxHash) return "Wallet submitted";
  if (walletConfirmationPending) return "Confirm in wallet";
  if (settlement?.funding) return "Ready to fund";

  return "Route ready";
}

function resolveButtonLabel({
  isBusy,
  settlement,
  walletConfirmationPending,
  routeUnavailable
}) {
  if (routeUnavailable) return "Coming soon";
  if (walletConfirmationPending) return "Open wallet again";
  if (isBusy) return "Preparing...";
  if (settlement?.funding) return "Send funding";

  return "Continue";
}

function CustomSelect({
  value,
  options,
  disabled,
  onChange,
  ariaLabel
}) {
  const [isOpen, setIsOpen] =
    useState(false);

  const shellRef =
    useRef(null);

  const safeOptions =
    normalizeArray(options);

  const selectedOption =
    safeOptions.find(option => option.value === value) ||
    safeOptions[0] ||
    null;

  useEffect(() => {
    function handleClickOutside(event) {
      if (!shellRef.current) return;

      if (!shellRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("click", handleClickOutside);

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
    }
  }, [disabled]);

  return (
    <div
      ref={shellRef}
      className={
        isOpen
          ? "connect-select-shell is-open"
          : "connect-select-shell"
      }
    >
      <button
        type="button"
        className="connect-select-trigger"
        disabled={disabled || safeOptions.length === 0}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen ? "true" : "false"}
        onClick={() => {
          if (disabled || safeOptions.length === 0) return;
          setIsOpen(current => !current);
        }}
      >
        <span className="connect-select-value">
          {selectedOption?.label || "Select"}
        </span>

        <span
          className="connect-select-chevron"
          aria-hidden="true"
        >
          ⌄
        </span>
      </button>

      <div
        className="connect-select-menu"
        role="listbox"
      >
        {safeOptions.map(option => {
          const isSelected =
            option.value === value;

          const optionDisabled =
            Boolean(option.disabled);

          return (
            <button
              key={option.value}
              type="button"
              disabled={optionDisabled}
              className={[
                "connect-select-option",
                isSelected ? "is-selected" : "",
                optionDisabled ? "is-disabled" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              role="option"
              aria-selected={isSelected ? "true" : "false"}
              aria-disabled={optionDisabled ? "true" : "false"}
              onClick={() => {
                if (optionDisabled) return;

                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SearchableSelect({
  value,
  options,
  disabled,
  onChange,
  ariaLabel,
  placeholder = "Search bank or wallet"
}) {
  const [isOpen, setIsOpen] =
    useState(false);

  const [query, setQuery] =
    useState("");

  const shellRef =
    useRef(null);

  const safeOptions =
    normalizeArray(options);

  const selectedOption =
    safeOptions.find(option => option.value === value) ||
    null;

  const filteredOptions =
    useMemo(() => {
      const search =
        normalizeSearchText(query);

      if (!search) {
        return safeOptions.slice(0, 40);
      }

      return safeOptions
        .filter(option =>
          normalizeSearchText(
            `${option.label} ${option.value}`
          ).includes(search)
        )
        .slice(0, 40);
    }, [
      query,
      safeOptions
    ]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!shellRef.current) return;

      if (!shellRef.current.contains(event.target)) {
        setIsOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("click", handleClickOutside);

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
      setQuery("");
    }
  }, [disabled]);

  return (
    <div
      ref={shellRef}
      className={
        isOpen
          ? "connect-select-shell is-open"
          : "connect-select-shell"
      }
    >
      <input
        type="text"
        className="connect-select-trigger"
        disabled={disabled || safeOptions.length === 0}
        aria-label={ariaLabel}
        placeholder={
          selectedOption?.label ||
          placeholder
        }
        value={
          isOpen
            ? query
            : selectedOption?.label || ""
        }
        onFocus={() => {
          if (disabled || safeOptions.length === 0) return;
          setIsOpen(true);
          setQuery("");
        }}
        onClick={() => {
          if (disabled || safeOptions.length === 0) return;
          setIsOpen(true);
        }}
        onChange={event => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
      />

      <div
        className="connect-select-menu"
        role="listbox"
      >
        {filteredOptions.length > 0 ? (
          filteredOptions.map(option => {
            const isSelected =
              option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                className={
                  isSelected
                    ? "connect-select-option is-selected"
                    : "connect-select-option"
                }
                role="option"
                aria-selected={isSelected ? "true" : "false"}
                onClick={() => {
                  onChange(option.value);
                  setQuery("");
                  setIsOpen(false);
                }}
              >
                {option.label}
              </button>
            );
          })
        ) : (
          <div className="connect-select-option">
            No matching institution
          </div>
        )}
      </div>
    </div>
  );
}

function CopyableValue({
  value,
  label
}) {
  return (
    <span className="route-info-action">
      <span
        className="route-info-value"
        title={value}
      >
        {shortId(value)}
      </span>

      <button
        type="button"
        className="copy-button"
        onClick={() => copyToClipboard(value)}
        aria-label={label}
      >
        ⧉
      </button>
    </span>
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

  const isPolygonNetwork =
    String(selectedNetwork || "").toLowerCase() === "polygon";

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
      await Promise.all(
        dynamicSources.map(async source => {
          if (dynamicOptionSources[source]) return;

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

        <CustomSelect
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

        <CustomSelect
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
          const options =
            filterFieldOptions({
              field,
              options:
                dynamicOptionSources[field.source],
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
                  routeUnavailable ||
                  options.length === 0
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

      <div className="route-info-grid">
        <div className="route-info-card">
          <span className="route-info-label">
            Network
          </span>

          <span className="route-info-value network-value">
            {isPolygonNetwork ? <PolygonIcon /> : null}

            <span>
              {getNetworkDisplayName(selectedNetwork)} · {selectedAsset}
            </span>
          </span>
        </div>

        {payoutIntentId ? (
          <div className="route-info-card">
            <span className="route-info-label">
              Route reference
            </span>

            <CopyableValue
              value={payoutIntentId}
              label="Copy route reference"
            />
          </div>
        ) : null}

        <div className="route-info-card">
          <span className="route-info-label">
            Status
          </span>

          <span className="route-status-pill">
            {displayStatus}
          </span>
        </div>
      </div>

      {fundingTxHash ? (
        <div className="wallet-tx-card">
          <span className="route-info-label">
            Wallet transaction
          </span>

          <CopyableValue
            value={fundingTxHash}
            label="Copy wallet transaction"
          />
        </div>
      ) : null}

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
