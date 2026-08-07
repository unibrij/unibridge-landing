// connect-app/src/components/PayoutForm.jsx

import {
  useEffect,
  useMemo,
  useState
} from "react";

import Select from "./payout-form/Select.jsx";
import SearchableSelect from "./payout-form/SearchableSelect.jsx";
import RouteInfo from "./payout-form/RouteInfo.jsx";
import PricingPreview from "./PricingPreview.jsx";

import {
  filterFieldOptions,
  normalizeDynamicOptions,
  resolveDynamicOptionEndpoint,
  resolveFieldSchemaKey
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
  new URLSearchParams(
    window.location.search
  ).get("debug") === "1";

function hasOwn(
  value = {},
  key
) {
  return Object.prototype.hasOwnProperty.call(
    value,
    key
  );
}

function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}

function normalizeLower(
  value
) {
  return normalizeString(
    value
  ).toLowerCase();
}

function normalizeDynamicFieldName(
  value
) {
  const name =
    normalizeString(
      value
    );

  switch (name) {
    case "recipientName":
    case "recipient_name":
      return "name";

    case "recipientAccountNumber":
    case "recipient_account_number":
      return "account";

    case "recipientAddress":
    case "recipient_address":
      return "recipient_address";

    case "recipientPhone":
    case "recipient_phone":
      return "phone";

    case "recipientPixKey":
    case "recipient_pix_key":
      return "pix_key";

    default:
      return name;
  }
}

function buildFieldLabel(
  name
) {
  const normalized =
    normalizeDynamicFieldName(
      name
    );

  switch (normalized) {
    case "name":
      return "Recipient name";

    case "account":
      return "Recipient account or wallet number";

    case "recipient_address":
      return "Recipient address";

    case "phone":
      return "Recipient phone";

    case "pix_key":
      return "PIX key";

    case "remarks":
      return "Remarks";

    default:
      return normalized
        .replace(
          /_/g,
          " "
        )
        .replace(
          /\b\w/g,
          character =>
            character.toUpperCase()
        );
  }
}

function normalizeFieldNameList(
  value
) {
  return normalizeArray(
    value
  )
    .map(item => {
      if (
        item &&
        typeof item ===
          "object"
      ) {
        return normalizeString(
          item.name ||
            item.field ||
            item.key
        );
      }

      return normalizeString(
        item
      );
    })
    .filter(Boolean);
}

function normalizeDynamicSchemaField({
  rawField,
  requiredNames,
  optionalNames
}) {
  const fieldObject =
    rawField &&
    typeof rawField ===
      "object" &&
    !Array.isArray(
      rawField
    )
      ? rawField
      : {};

  const rawName =
    normalizeString(
      fieldObject.name ||
        fieldObject.field ||
        fieldObject.key ||
        rawField
    );

  if (!rawName) {
    return null;
  }

  const name =
    normalizeDynamicFieldName(
      rawName
    );

  if (!name) {
    return null;
  }

  const explicitlyRequired =
    fieldObject.required ===
      true;

  const explicitlyOptional =
    fieldObject.required ===
      false;

  const required =
    explicitlyRequired ||
    (
      !explicitlyOptional &&
      (
        requiredNames.has(
          rawName
        ) ||
        requiredNames.has(
          name
        )
      )
    );

  const type =
    normalizeLower(
      fieldObject.type
    ) ||
    (
      name === "phone"
        ? "tel"
        : "text"
    );

  const normalized = {
    name,

    label:
      normalizeString(
        fieldObject.label
      ) ||
      buildFieldLabel(
        name
      ),

    type,

    required:
      required &&
      !optionalNames.has(
        rawName
      ) &&
      !optionalNames.has(
        name
      )
  };

  const placeholder =
    normalizeString(
      fieldObject.placeholder
    );

  if (placeholder) {
    normalized.placeholder =
      placeholder;
  }

  return normalized;
}

function normalizeSelectedFieldSchema(
  fieldSchema
) {
  if (!fieldSchema) {
    return [];
  }

  if (
    Array.isArray(
      fieldSchema
    )
  ) {
    return fieldSchema
      .map(rawField =>
        normalizeDynamicSchemaField({
          rawField,

          requiredNames:
            new Set(),

          optionalNames:
            new Set()
        })
      )
      .filter(Boolean);
  }

  if (
    typeof fieldSchema !==
      "object"
  ) {
    return [];
  }

  const requiredNames =
    new Set(
      normalizeFieldNameList(
        fieldSchema.required
      )
    );

  const optionalNames =
    new Set(
      normalizeFieldNameList(
        fieldSchema.optional
      )
    );

  let rawFields =
    normalizeArray(
      fieldSchema.fields
    );

  if (
    rawFields.length ===
      0
  ) {
    rawFields = [
      ...requiredNames,
      ...optionalNames
    ];
  }

  const map =
    new Map();

  rawFields
    .map(rawField =>
      normalizeDynamicSchemaField({
        rawField,
        requiredNames,
        optionalNames
      })
    )
    .filter(Boolean)
    .forEach(field => {
      if (
        !map.has(
          field.name
        )
      ) {
        map.set(
          field.name,
          field
        );
      }
    });

  return Array.from(
    map.values()
  );
}

function resolveSelectedOption({
  options,
  value
}) {
  if (!value) {
    return null;
  }

  return (
    normalizeArray(
      options
    ).find(
      option =>
        option?.value ===
        value
    ) ||
    null
  );
}

function resolveOptionDynamicFields({
  field,
  option
}) {
  if (!field || !option) {
    return [];
  }

  const schemaKey =
    resolveFieldSchemaKey(
      field
    );

  if (!schemaKey) {
    return [];
  }

  const fieldSchema =
    option
      ?.raw
      ?.[
        schemaKey
      ];

  return normalizeSelectedFieldSchema(
    fieldSchema
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
  const [
    dynamicOptionSources,
    setDynamicOptionSources
  ] = useState({});

  const routeUnavailable =
    isComingSoonRoute(
      selectedRoute
    );

  const routeAssets =
    getRouteAssets(
      selectedRoute
    );

  const beneficiaryFields =
    getBeneficiaryFields(
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

  const dynamicEndpoints =
    useMemo(
      () =>
        Array.from(
          new Set(
            beneficiaryFields
              .map(field =>
                resolveDynamicOptionEndpoint(
                  field
                )
              )
              .filter(Boolean)
          )
        ),
      [
        beneficiaryFields
      ]
    );

  useEffect(() => {
    if (
      dynamicEndpoints.length ===
      0
    ) {
      return;
    }

    let cancelled =
      false;

    async function loadDynamicSources() {
      const missingEndpoints =
        dynamicEndpoints.filter(
          endpoint =>
            !hasOwn(
              dynamicOptionSources,
              endpoint
            )
        );

      if (
        missingEndpoints.length ===
        0
      ) {
        return;
      }

      await Promise.all(
        missingEndpoints.map(
          async endpoint => {
            try {
              const response =
                await fetch(
                  endpoint
                );

              if (
                !response.ok
              ) {
                throw new Error(
                  `dynamic_options_failed:${response.status}`
                );
              }

              const payload =
                await response.json();

              const options =
                normalizeDynamicOptions(
                  payload
                );

              if (cancelled) {
                return;
              }

              setDynamicOptionSources(
                current => ({
                  ...current,

                  [endpoint]:
                    options
                })
              );
            } catch (err) {
              console.warn(
                "CONNECT_DYNAMIC_OPTIONS_FAILED",
                endpoint,
                err?.message ||
                  String(
                    err
                  )
              );

              if (cancelled) {
                return;
              }

              setDynamicOptionSources(
                current => ({
                  ...current,

                  [endpoint]:
                    []
                })
              );
            }
          }
        )
      );
    }

    loadDynamicSources();

    return () => {
      cancelled =
        true;
    };
  }, [
    dynamicEndpoints,
    dynamicOptionSources
  ]);

  useEffect(() => {
    if (!selectedAsset) {
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
    setForm
  ]);

  const dynamicBeneficiaryFields =
    useMemo(
      () => {
        const fields =
          [];

        const existingNames =
          new Set(
            beneficiaryFields
              .map(
                field =>
                  field?.name
              )
              .filter(Boolean)
          );

        for (
          const field of
            beneficiaryFields
        ) {
          const schemaKey =
            resolveFieldSchemaKey(
              field
            );

          if (!schemaKey) {
            continue;
          }

          const endpoint =
            resolveDynamicOptionEndpoint(
              field
            );

          if (!endpoint) {
            continue;
          }

          const filteredOptions =
            filterFieldOptions({
              field,

              options:
                dynamicOptionSources[
                  endpoint
                ],

              selectedRoute
            });

          const selectedOption =
            resolveSelectedOption({
              options:
                filteredOptions,

              value:
                form
                  .beneficiary
                  ?.[
                    field.name
                  ] ||
                ""
            });

          if (!selectedOption) {
            continue;
          }

          const dynamicFields =
            resolveOptionDynamicFields({
              field,
              option:
                selectedOption
            });

          for (
            const dynamicField of
              dynamicFields
          ) {
            if (
              existingNames.has(
                dynamicField.name
              )
            ) {
              continue;
            }

            existingNames.add(
              dynamicField.name
            );

            fields.push(
              dynamicField
            );
          }
        }

        return fields;
      },
      [
        beneficiaryFields,
        dynamicOptionSources,
        form.beneficiary,
        selectedRoute
      ]
    );

  const renderedBeneficiaryFields =
    useMemo(
      () => [
        ...beneficiaryFields,
        ...dynamicBeneficiaryFields
      ],
      [
        beneficiaryFields,
        dynamicBeneficiaryFields
      ]
    );

  function updateDynamicSelectField({
    field,
    value,
    options
  }) {
    const fieldName =
      field.name;

    const previousValue =
      form
        .beneficiary
        ?.[
          fieldName
        ] ||
      "";

    const previousOption =
      resolveSelectedOption({
        options,
        value:
          previousValue
      });

    const previousDynamicFields =
      resolveOptionDynamicFields({
        field,
        option:
          previousOption
      });

    const protectedFieldNames =
      new Set(
        beneficiaryFields
          .map(
            item =>
              item?.name
          )
          .filter(Boolean)
      );

    setForm(
      current => {
        const beneficiary = {
          ...(
            current
              .beneficiary ||
            {}
          )
        };

        for (
          const dynamicField of
            previousDynamicFields
        ) {
          const dynamicName =
            dynamicField?.name;

          if (
            !dynamicName ||
            protectedFieldNames.has(
              dynamicName
            )
          ) {
            continue;
          }

          delete beneficiary[
            dynamicName
          ];
        }

        beneficiary[
          fieldName
        ] =
          value;

        return {
          ...current,

          beneficiary
        };
      }
    );
  }

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

  const pricingRequired =
    !isReturnedFlow &&
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

  const amountAssetDisabled =
    isBusy ||
    isReturnedFlow ||
    routeUnavailable;

  return (
    <section className="payout-form">
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
            isBusy ||
            isReturnedFlow
          }
          ariaLabel="Select payout route"
          onChange={
            changeRoute
          }
        />
      </label>

      <label className="amount-asset-field">
        Amount

        <div
          className={
            `amount-asset-control${
              amountAssetDisabled
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
              form.amount
            }
            disabled={
              amountAssetDisabled
            }
            aria-label="Payout amount"
            onChange={
              event =>
                setForm(
                  current => ({
                    ...current,

                    amount:
                      event
                        .target
                        .value
                  })
                )
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
                amountAssetDisabled
              }
              ariaLabel="Select funding asset"
              onChange={
                asset =>
                  setForm(
                    current => ({
                      ...current,

                      asset
                    })
                  )
              }
            />
          </div>
        </div>
      </label>

      {renderedBeneficiaryFields.map(
        field => {
          const fieldName =
            field.name;

          const dynamicEndpoint =
            resolveDynamicOptionEndpoint(
              field
            );

          if (
            field.type ===
              "select" &&
            dynamicEndpoint
          ) {
            const options =
              filterFieldOptions({
                field,

                options:
                  dynamicOptionSources[
                    dynamicEndpoint
                  ],

                selectedRoute
              });

            return (
              <label
                key={
                  fieldName
                }
              >
                {field.label}

                <SearchableSelect
                  value={
                    form
                      .beneficiary
                      ?.[
                        fieldName
                      ] ||
                    ""
                  }
                  options={
                    options
                  }
                  disabled={
                    isBusy ||
                    isReturnedFlow ||
                    routeUnavailable
                  }
                  ariaLabel={`Search ${field.label}`}
                  placeholder="Search bank or wallet"
                  onChange={
                    value => {
                      if (
                        resolveFieldSchemaKey(
                          field
                        )
                      ) {
                        updateDynamicSelectField({
                          field,
                          value,
                          options
                        });

                        return;
                      }

                      updateBeneficiaryField(
                        fieldName,
                        value
                      );
                    }
                  }
                />
              </label>
            );
          }

          return (
            <label
              key={
                fieldName
              }
            >
              {field.label}

              <input
                type={
                  field.type ||
                  "text"
                }
                placeholder={
                  field.placeholder
                }
                required={
                  field.required
                }
                disabled={
                  isBusy ||
                  isReturnedFlow ||
                  routeUnavailable
                }
                value={
                  form
                    .beneficiary
                    ?.[
                      fieldName
                    ] ||
                  ""
                }
                onChange={
                  event =>
                    updateBeneficiaryField(
                      fieldName,
                      event
                        .target
                        .value
                    )
                }
              />
            </label>
          );
        }
      )}

      {routeUnavailable ? (
        <div className="wallet-pending-card">
          <strong>
            Coming soon
          </strong>

          <span>
            This payout corridor is not available yet.
          </span>
        </div>
      ) : null}

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

      <button
        type="button"
        onClick={
          handleSend
        }
        disabled={
          routeUnavailable ||
          pricingUnavailable ||
          (
            isBusy &&
            !walletConfirmationPending
          )
        }
      >
        {buttonLabel}
      </button>

      {walletConfirmationPending &&
      !fundingTxHash ? (
        <div className="wallet-pending-card">
          <strong>
            Wallet confirmation pending
          </strong>

          <span>
            Return to your wallet and confirm the transaction.
          </span>
        </div>
      ) : null}

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
