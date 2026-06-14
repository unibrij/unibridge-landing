// connect-app/src/components/PayoutForm.jsx

const SHOW_DEBUG =
  import.meta.env.DEV ||
  new URLSearchParams(window.location.search).get("debug") === "1";

function shortId(value = "") {
  const text =
    String(value || "").trim();

  if (!text) {
    return "—";
  }

  if (text.length <= 20) {
    return text;
  }

  return `${text.slice(0, 10)}...${text.slice(-6)}`;
}

async function copyToClipboard(value) {
  const text =
    String(value || "").trim();

  if (!text) {
    return;
  }

  await navigator.clipboard.writeText(text);
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function getRouteAssets(route = {}) {
  const assets =
    normalizeArray(route.assets);

  if (assets.length > 0) {
    return assets;
  }

  return route.asset ? [route.asset] : ["USDT"];
}

function getBeneficiaryFields(route = {}) {
  return normalizeArray(route.beneficiaryFields);
}

function getRouteFlag(route = {}) {
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

  if (
    country === "BR" ||
    id.includes("br") ||
    label.includes("brazil") ||
    label.includes("pix")
  ) {
    return "🇧🇷";
  }

  if (
    country === "PH" ||
    id.includes("ph") ||
    label.includes("philippines") ||
    label.includes("gcash") ||
    label.includes("instapay")
  ) {
    return "🇵🇭";
  }

  return "🌐";
}

function getRouteDisplayLabel(route = {}) {
  return `${getRouteFlag(route)} ${route.label || route.name || route.id || "Route"}`;
}

function getNetworkDisplayName(network = "") {
  const value =
    String(network || "").trim().toLowerCase();

  if (value === "polygon") {
    return "Polygon";
  }

  return network || "Network";
}

function PolygonIcon() {
  return (
    <span
      className="network-icon polygon-network-icon"
      aria-hidden="true"
    >
      <img
        src="/connect/icons/networks/polygon.svg"
        alt=""
        width="17"
        height="17"
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}

function resolveDisplayStatus({
  settlement,
  fundingTxHash,
  walletConfirmationPending
}) {
  if (fundingTxHash) {
    return "Wallet submitted";
  }

  if (walletConfirmationPending) {
    return "Confirm in wallet";
  }

  if (settlement?.funding) {
    return "Ready to fund";
  }

  return "Route ready";
}

function resolveButtonLabel({
  isBusy,
  settlement,
  walletConfirmationPending
}) {
  if (walletConfirmationPending) {
    return "Open wallet again";
  }

  if (isBusy) {
    return "Preparing...";
  }

  if (settlement?.funding) {
    return "Send funding";
  }

  return "Continue";
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
  const routeAssets =
    getRouteAssets(selectedRoute);

  const beneficiaryFields =
    getBeneficiaryFields(selectedRoute);

  const selectedAsset =
    form.asset || routeAssets[0] || "USDT";

  const selectedNetwork =
    selectedRoute?.network || "polygon";

  const isPolygonNetwork =
    String(selectedNetwork || "").toLowerCase() === "polygon";

  const displayStatus =
    resolveDisplayStatus({
      settlement,
      fundingTxHash,
      walletConfirmationPending
    });

  const buttonLabel =
    resolveButtonLabel({
      isBusy,
      settlement,
      walletConfirmationPending
    });

  return (
    <section className="payout-form">
      <label>
        Route
        <select
          value={selectedRouteId}
          onChange={e => changeRoute(e.target.value)}
          disabled={isBusy || isReturnedFlow}
        >
          {normalizeArray(routes).map(route => (
            <option key={route.id} value={route.id}>
              {getRouteDisplayLabel(route)}
            </option>
          ))}
        </select>
      </label>

      <label>
        Amount
        <input
          type="number"
          min="1"
          placeholder="100"
          value={form.amount}
          disabled={isBusy || isReturnedFlow}
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
        <select
          value={selectedAsset}
          disabled={isBusy || isReturnedFlow}
          onChange={e =>
            setForm({
              ...form,
              asset: e.target.value
            })
          }
        >
          {routeAssets.map(asset => (
            <option key={asset} value={asset}>
              {asset}
            </option>
          ))}
        </select>
      </label>

      {beneficiaryFields.map(field => (
        <label key={field.name}>
          {field.label}
          <input
            type={field.type || "text"}
            placeholder={field.placeholder}
            required={field.required}
            disabled={isBusy || isReturnedFlow}
            value={form.beneficiary?.[field.name] || ""}
            onChange={e =>
              updateBeneficiaryField(
                field.name,
                e.target.value
              )
            }
          />
        </label>
      ))}

      <button
        type="button"
        onClick={handleSend}
        disabled={isBusy && !walletConfirmationPending}
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
