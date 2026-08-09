// connect-app/src/components/payout-form/TransferFields.jsx

import Select from "./Select.jsx";

export default function TransferFields({
  selectedRouteId,
  routeOptions,

  form,
  setForm,

  selectedAsset,
  assetOptions,

  disabled = false,

  changeRoute
}) {
  return (
    <>
      <label>
        Route

        <Select
          value={
            selectedRouteId
          }
          options={
            routeOptions
          }
          disabled={
            disabled
          }
          ariaLabel="Select payout route"
          onChange={
            routeId => {
              if (disabled) {
                return;
              }

              changeRoute(
                routeId
              );
            }
          }
        />
      </label>

      <label className="amount-asset-field">
        Amount

        <div
          className={
            `amount-asset-control${
              disabled
                ? " is-disabled"
                : ""
            }`
          }
        >
          <input
            className="amount-asset-input"
            type="number"
            min="1"
            inputMode="decimal"
            placeholder="100"
            value={
              form?.amount ||
              ""
            }
            disabled={
              disabled
            }
            aria-label="Payout amount"
            onChange={
              event => {
                if (disabled) {
                  return;
                }

                const amount =
                  event
                    .target
                    .value;

                setForm(
                  current => ({
                    ...current,
                    amount
                  })
                );
              }
            }
          />

          <div className="amount-asset-selector">
            <Select
              value={
                selectedAsset
              }
              options={
                assetOptions
              }
              disabled={
                disabled
              }
              ariaLabel="Select funding asset"
              onChange={
                asset => {
                  if (disabled) {
                    return;
                  }

                  setForm(
                    current => ({
                      ...current,
                      asset
                    })
                  );
                }
              }
            />
          </div>
        </div>
      </label>
    </>
  );
}
