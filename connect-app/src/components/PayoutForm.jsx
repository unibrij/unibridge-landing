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

function resolveDisplayStatus({
  settlement,
  fundingTxHash
}) {
  if (fundingTxHash) {
    return "Wallet submitted";
  }

  if (settlement?.funding) {
    return "Ready to fund";
  }

  return "Route ready";
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
  payoutIntentId,
  debug,
  handleSend,
  changeRoute,
  updateBeneficiaryField,
  routes
}) {
  const displayStatus =
    resolveDisplayStatus({
      settlement,
      fundingTxHash
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
          {routes.map(route => (
            <option key={route.id} value={route.id}>
              {route.label}
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
          value={form.asset}
          disabled={isBusy || isReturnedFlow}
          onChange={e =>
            setForm({
              ...form,
              asset: e.target.value
            })
          }
        >
          {selectedRoute.assets.map(asset => (
            <option key={asset} value={asset}>
              {asset}
            </option>
          ))}
        </select>
      </label>

      {selectedRoute.beneficiaryFields.map(field => (
        <label key={field.name}>
          {field.label}
          <input
            type={field.type || "text"}
            placeholder={field.placeholder}
            required={field.required}
            disabled={isBusy || isReturnedFlow}
            value={form.beneficiary[field.name] || ""}
            onChange={e =>
              updateBeneficiaryField(
                field.name,
                e.target.value
              )
            }
          />
        </label>
      ))}

      <button onClick={handleSend} disabled={isBusy}>
        {isBusy
          ? "Preparing..."
          : settlement?.funding
            ? "Send funding"
            : "Continue"}
      </button>

      <div className="route-info-grid">
        <div className="route-info-card">
          <span className="route-info-label">
            Network
          </span>

          <span className="route-info-value">
            Polygon · USDT
          </span>
        </div>

        {payoutIntentId ? (
          <div className="route-info-card">
            <span className="route-info-label">
              Route reference
            </span>

            <span
              className="route-info-value"
              title={payoutIntentId}
            >
              {shortId(payoutIntentId)}
            </span>
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

          <span
            className="route-info-value"
            title={fundingTxHash}
          >
            {shortId(fundingTxHash)}
          </span>
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
