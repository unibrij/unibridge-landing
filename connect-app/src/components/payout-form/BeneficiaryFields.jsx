// connect-app/src/components/payout-form/BeneficiaryFields.jsx

import SearchableSelect from "./SearchableSelect.jsx";

import {
  resolveDynamicOptionEndpoint,
  resolveFieldSchemaKey
} from "./dynamicOptions.js";

export default function BeneficiaryFields({
  form,
  renderedFields,
  getOptions,
  updateDynamicField,
  updateBeneficiaryField,
  disabled = false
}) {
  return (
    <>
      {renderedFields.map(
        field => {
          const fieldName =
            field?.name;

          if (!fieldName) {
            return null;
          }

          const value =
            form
              ?.beneficiary
              ?.[
                fieldName
              ] ||
            "";

          const dynamicEndpoint =
            resolveDynamicOptionEndpoint(
              field
            );

          /*
           * Preserve the existing behavior:
           *
           * Only select fields backed by a dynamic
           * endpoint render as SearchableSelect.
           */
          if (
            field.type ===
              "select" &&
            dynamicEndpoint
          ) {
            const options =
              getOptions(
                field
              );

            return (
              <label
                key={
                  fieldName
                }
              >
                {field.label}

                <SearchableSelect
                  value={
                    value
                  }
                  options={
                    options
                  }
                  disabled={
                    disabled
                  }
                  ariaLabel={`Search ${field.label}`}
                  placeholder={
                    field.placeholder ||
                    "Search bank or wallet"
                  }
                  onChange={
                    nextValue => {
                      if (disabled) {
                        return;
                      }

                      /*
                       * Schema-aware options may
                       * add or remove dependent
                       * beneficiary fields.
                       */
                      if (
                        resolveFieldSchemaKey(
                          field
                        )
                      ) {
                        updateDynamicField({
                          field,
                          value:
                            nextValue,
                          options
                        });

                        return;
                      }

                      updateBeneficiaryField(
                        fieldName,
                        nextValue
                      );
                    }
                  }
                />
              </label>
            );
          }

          /*
           * All remaining beneficiary fields keep
           * the original input behavior.
           */
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
                  disabled
                }
                value={
                  value
                }
                onChange={
                  event => {
                    if (disabled) {
                      return;
                    }

                    updateBeneficiaryField(
                      fieldName,
                      event
                        .target
                        .value
                    );
                  }
                }
              />
            </label>
          );
        }
      )}
    </>
  );
}
