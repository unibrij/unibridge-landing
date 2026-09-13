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

    if (
      key ===
      "className"
    ) {
      element.className =
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
        "numeric",

      placeholder:
        "123456789"
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
        "address.".length
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


function createSurfaceField({
  definition,
  field,
  stripeKycInfo
}) {
  const inputId =
    `stripe-kyc-${definition.name}`;

  /*
  Existing Surface structure:

  <label class="field">
    <span>Label</span>
    <input>
  </label>

  This directly reuses controls.css.
  */

  const wrapper =
    createElement(
      "label",
      {
        className:
          "field",

        for:
          inputId
      }
    );

  const labelText =
    createElement(
      "span",
      {
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

  wrapper.append(
    labelText,
    input
  );

  return {
    wrapper,
    input
  };
}


function applyOverlayLayout(
  overlay
) {
  /*
  Surface currently has no shared modal / overlay
  class.

  Keep only the mechanical fullscreen positioning
  here. The visible card, fields, errors and buttons
  all reuse the existing Surface design system.
  */

  Object.assign(
    overlay.style,
    {
      position:
        "fixed",

      inset:
        "0",

      zIndex:
        "2147483000",

      display:
        "flex",

      alignItems:
        "center",

      justifyContent:
        "center",

      boxSizing:
        "border-box",

      padding:
        "16px",

      overflowY:
        "auto",

      background:
        "rgba(0, 8, 28, 0.78)"
    }
  );
}


function applyPanelLayout(
  panel
) {
  /*
  .card provides the visual styling.

  These are layout-only adjustments so the existing
  Surface card behaves correctly inside a fixed
  overlay.
  */

  Object.assign(
    panel.style,
    {
      width:
        "min(100%, 440px)",

      maxHeight:
        "calc(100vh - 32px)",

      marginTop:
        "0",

      overflowY:
        "auto"
    }
  );
}


function applyActionsLayout(
  actions
) {
  /*
  Buttons themselves use the existing Surface
  .button styles. This container only controls
  their layout.
  */

  Object.assign(
    actions.style,
    {
      display:
        "grid",

      gridTemplateColumns:
        "1fr 1fr",

      gap:
        "10px"
    }
  );
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

      applyOverlayLayout(
        overlay
      );

      /*
      Existing Surface visual container.
      */

      const panel =
        createElement(
          "div",
          {
            className:
              "card"
          }
        );

      applyPanelLayout(
        panel
      );

      /*
      Existing Surface heading component.
      */

      const header =
        createElement(
          "div",
          {
            className:
              "entry-header"
          }
        );

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

      header.append(
        title,
        description
      );

      /*
      Existing Surface form layout.
      */

      const form =
        createElement(
          "form",
          {
            className:
              "form-grid"
          }
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

        const {
          wrapper,
          input
        } =
          createSurfaceField({
            definition,
            field,
            stripeKycInfo
          });

        inputs[
          definition.name
        ] =
          input;

        form.appendChild(
          wrapper
        );
      }

      /*
      Existing Surface error style.
      */

      const errorBox =
        createElement(
          "div",
          {
            className:
              "field-error-message",

            role:
              "alert"
          }
        );

      /*
      Existing Surface button styles.
      */

      const actions =
        createElement(
          "div"
        );

      applyActionsLayout(
        actions
      );

      const cancelButton =
        createElement(
          "button",
          {
            type:
              "button",

            className:
              "button secondary",

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

            className:
              "button primary",

            textContent:
              "Continue"
          }
        );


      function clearLocalSensitiveInput() {
        if (
          inputs.id_number
        ) {
          inputs
            .id_number
            .value =
            "";
        }
      }


      cancelButton
        .addEventListener(
          "click",
          () => {
            clearLocalSensitiveInput();

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

            clearLocalSensitiveInput();

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
        header,
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
