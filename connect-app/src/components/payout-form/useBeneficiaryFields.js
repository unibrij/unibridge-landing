// connect-app/src/components/payout-form/useBeneficiaryFields.js

import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";

import {
  filterFieldOptions,
  normalizeDynamicOptions,
  resolveDynamicOptionEndpoint,
  resolveFieldSchemaKey
} from "./dynamicOptions.js";

import {
  getBeneficiaryFields
} from "./routeUtils.js";

import {
  resolveOptionDynamicFields,
  resolveSelectedOption
} from "./beneficiarySchema.js";

function hasOwn(
  value = {},
  key
) {
  return Object.prototype.hasOwnProperty.call(
    value,
    key
  );
}

export function useBeneficiaryFields({
  selectedRoute,
  form,
  setForm,
  disabled = false
}) {
  const [
    dynamicOptionSources,
    setDynamicOptionSources
  ] = useState({});

  const beneficiaryFields =
    useMemo(
      () =>
        getBeneficiaryFields(
          selectedRoute
        ),
      [
        selectedRoute
      ]
    );

  /*
   * Collect only the remote option endpoints
   * required by the current route.
   */
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

  /*
   * Load each dynamic option source once.
   *
   * Sources are cached by endpoint for the lifetime
   * of the mounted payout form.
   */
  useEffect(() => {
    if (
      dynamicEndpoints.length ===
      0
    ) {
      return;
    }

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

    let cancelled =
      false;

    async function loadEndpoint(
      endpoint
    ) {
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
      }
      catch (
        error
      ) {
        console.warn(
          "CONNECT_DYNAMIC_OPTIONS_FAILED",
          endpoint,
          error?.message ||
            String(
              error
            )
        );

        if (cancelled) {
          return;
        }

        /*
         * Cache failure as an empty result so the
         * component does not retry on every render.
         */
        setDynamicOptionSources(
          current => ({
            ...current,

            [endpoint]:
              []
          })
        );
      }
    }

    void Promise.all(
      missingEndpoints.map(
        loadEndpoint
      )
    );

    return () => {
      cancelled =
        true;
    };
  }, [
    dynamicEndpoints,
    dynamicOptionSources
  ]);

  /*
   * Return route-aware options for one beneficiary
   * field without exposing source-cache details to
   * the rendering component.
   */
  const getOptions =
    useCallback(
      field => {
        const endpoint =
          resolveDynamicOptionEndpoint(
            field
          );

        if (!endpoint) {
          return [];
        }

        return filterFieldOptions({
          field,

          options:
            dynamicOptionSources[
              endpoint
            ],

          selectedRoute
        });
      },
      [
        dynamicOptionSources,
        selectedRoute
      ]
    );

  /*
   * Dynamic schemas may add fields after a bank,
   * wallet or payout rail is selected.
   *
   * Keep the route's explicit beneficiary fields
   * authoritative and append only genuinely new
   * dynamic fields.
   */
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
          if (
            !resolveFieldSchemaKey(
              field
            )
          ) {
            continue;
          }

          const options =
            getOptions(
              field
            );

          const selectedOption =
            resolveSelectedOption({
              options,

              value:
                form
                  ?.beneficiary
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
              !dynamicField?.name ||
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
        form?.beneficiary,
        getOptions
      ]
    );

  const renderedFields =
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

  /*
   * Update a dynamic select and remove fields that
   * belonged only to the previously selected option.
   *
   * Explicit route fields are never deleted.
   */
  const updateDynamicField =
    useCallback(
      ({
        field,
        value,
        options
      }) => {
        if (
          disabled ||
          !field?.name
        ) {
          return;
        }

        const fieldName =
          field.name;

        const protectedFieldNames =
          new Set(
            beneficiaryFields
              .map(
                beneficiaryField =>
                  beneficiaryField?.name
              )
              .filter(Boolean)
          );

        setForm(
          current => {
            const beneficiary = {
              ...(
                current
                  ?.beneficiary ||
                {}
              )
            };

            const previousValue =
              beneficiary[
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
      },
      [
        beneficiaryFields,
        disabled,
        setForm
      ]
    );

  return {
    beneficiaryFields,
    renderedFields,
    getOptions,
    updateDynamicField
  };
}

export default useBeneficiaryFields;
