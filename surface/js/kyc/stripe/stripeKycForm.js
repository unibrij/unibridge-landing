// unibridge-landing/surface/js/kyc/stripe/stripeKycForm.js

import {
  assertSupportedMissingFields,
  buildStripeKycSupplement,
  normalizeLocalUsSsn
} from "./stripeKycFields.js";

const OVERLAY_ID =
  "stripeKycOverlay";

function createElement(
  tag,
  props = {}
) {
  const element =
    document.createElement(
      tag
    );

  for (
    const [
      key,
      value
    ] of Object.entries(
      props
    )
  ) {
    if (
      key ===
      "textContent"
    ) {
      element.textContent =
        value;

      continue;
    }

    element.setAttribute(
      key,
      value
    );
  }

  return element;
}

export function resetStripeKycForm() {
  document
    .getElementById(
      OVERLAY_ID
    )
    ?.remove();
}

function getFieldDefinition(
  field
) {
  const fields = {
    given_name: {
      name:
        "given_name",

      label:
        "First name",

      autocomplete:
        "given-name"
    },

    surname: {
      name:
        "surname",

      label:
        "Last name",

      autocomplete:
        "family-name"
    },

    date_of_birth: {
      name:
        "date_of_birth",

      label:
        "Date of birth",

      type:
        "date",

      autocomplete:
        "bday"
    },

    "address.line1": {
      name:
        "address_line1",

      label:
        "Residential address",

      autocomplete:
        "address-line1"
    },

    "address.line2": {
      name:
        "address_line2",

      label:
        "Apartment, suite, etc.",

      autocomplete:
        "address-line2"
    },

    "address.city": {
      name:
        "address_city",

      label:
        "City",

      autocomplete:
        "address-level2"
    },

    "address.state": {
      name:
        "address_state",

      label:
        "State",

      autocomplete:
        "address-level1"
    },

    "address.postal_code": {
      name:
        "address_postal_code",

      label:
        "ZIP / postal code",

      autocomplete:
        "postal-code"
    },

    "address.country": {
      name:
        "address_country",

      label:
        "Country code",

      autocomplete:
        "country",

      placeholder:
        "US"
    },

    id_number: {
      name:
        "id_number",

      label:
        "Social Security Number",

      type:
        "password",

      autocomplete:
        "off",

      inputmode:
        "numeric"
    }
  };

  return (
    fields[field] ??
    null
  );
}

function readExistingValue(
  stripeKycInfo,
  field
) {
  if (
    field ===
      "given_name" ||
    field ===
      "surname"
  ) {
    return (
      stripeKycInfo?.[field] ??
      ""
    );
  }

  if (
    field.startsWith(
      "address."
    )
  ) {
    const key =
      field.slice(
        8
      );

    return (
      stripeKycInfo
        ?.address
        ?.[key] ??
      ""
    );
  }

  return "";
}

export function requestStripeKycFields({
  missingFields = [],
  stripeKycInfo = {}
} = {}) {
  const normalizedMissingFields =
    Array.isArray(
      missingFields
    )
      ? missingFields
      : [];

  assertSupportedMissingFields(
    normalizedMissingFields
  );

  if (
    normalizedMissingFields
      .length === 0
  ) {
    return Promise.resolve({
      supplement:
        {},

      idNumber:
        null
    });
  }

  resetStripeKycForm();

  return new Promise(
    (
      resolve,
      reject
    ) => {
      const overlay =
        createElement(
          "div",
          {
            id:
              OVERLAY_ID
          }
        );

      overlay.className =
        "stripe-kyc-overlay";

      const panel =
        createElement(
          "div"
        );

      panel.className =
        "stripe-kyc-panel";

      const title =
        createElement(
          "h2",
          {
            textContent:
              "Additional information required"
          }
        );

      const description =
        createElement(
          "p",
          {
            textContent:
              "Stripe requires a few additional details to continue with bank funding."
          }
        );

      const form =
        createElement(
          "form"
        );

      const inputs =
        {};

      for (
        const field
        of normalizedMissingFields
      ) {
        const definition =
          getFieldDefinition(
            field
          );

        if (!definition) {
          continue;
        }

        const wrapper =
          createElement(
            "div"
          );

        wrapper.className =
          "stripe-kyc-field";

        const inputId =
          `stripe-kyc-${definition.name}`;

        const label =
          createElement(
            "label",
            {
              for:
                inputId,

              textContent:
                definition.label
            }
          );

        const input =
          createElement(
            "input",
            {
              id:
                inputId,

              type:
                definition.type ??
                "text",

              name:
                definition.name
            }
          );

        input.value =
          readExistingValue(
            stripeKycInfo,
            field
          );

        if (
          definition.autocomplete
        ) {
          input.autocomplete =
            definition.autocomplete;
        }

        if (
          definition.inputmode
        ) {
          input.inputMode =
            definition.inputmode;
        }

        if (
          definition.placeholder
        ) {
          input.placeholder =
            definition.placeholder;
        }

        inputs[
          definition.name
        ] =
          input;

        wrapper.append(
          label,
          input
        );

        form.appendChild(
          wrapper
        );
      }

      const errorBox =
        createElement(
          "div"
        );

      errorBox.className =
        "stripe-kyc-error";

      const actions =
        createElement(
          "div"
        );

      actions.className =
        "stripe-kyc-actions";

      const cancelButton =
        createElement(
          "button",
          {
            type:
              "button",

            textContent:
              "Cancel"
          }
        );

      const submitButton =
        createElement(
          "button",
          {
            type:
              "submit",

            textContent:
              "Continue"
          }
        );

      cancelButton
        .addEventListener(
          "click",
          () => {
            if (
              inputs.id_number
            ) {
              inputs
                .id_number
                .value =
                "";
            }

            resetStripeKycForm();

            reject(
              new Error(
                "stripe_kyc_cancelled"
              )
            );
          }
        );

      form.addEventListener(
        "submit",
        (
          event
        ) => {
          event.preventDefault();

          errorBox.textContent =
            "";

          try {
            const values =
              Object.fromEntries(
                Object.entries(
                  inputs
                )
                  .map(
                    ([
                      name,
                      input
                    ]) => [
                      name,
                      input.value
                    ]
                  )
              );

            const supplement =
              buildStripeKycSupplement(
                values,
                normalizedMissingFields
              );

            const idNumber =
              normalizedMissingFields
                .includes(
                  "id_number"
                )
                ? normalizeLocalUsSsn(
                    values.id_number
                  )
                : null;

            if (
              inputs.id_number
            ) {
              inputs
                .id_number
                .value =
                "";
            }

            resetStripeKycForm();

            resolve({
              supplement,
              idNumber
            });
          } catch (
            error
          ) {
            errorBox.textContent =
              error?.message ??
              "Invalid information.";
          }
        }
      );

      actions.append(
        cancelButton,
        submitButton
      );

      form.append(
        errorBox,
        actions
      );

      panel.append(
        title,
        description,
        form
      );

      overlay.appendChild(
        panel
      );

      document.body
        .appendChild(
          overlay
        );

      form
        .querySelector(
          "input"
        )
        ?.focus();
    }
  );
}
