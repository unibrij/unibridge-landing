// connect-app/src/components/PayoutForm.jsx

const SHOW_DEBUG =
  import.meta.env.DEV ||
  new URLSearchParams(window.location.search).get("debug") === "1";

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

      <p className="connect-note">
        This route uses Polygon USDT only.
      </p>

      {payoutIntentId ? (
        <p className="connect-note">
          Route reference: {payoutIntentId}
        </p>
      ) : null}

      {fundingTxHash ? (
        <p className="connect-note">
          Wallet transaction submitted: {fundingTxHash}
        </p>
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
