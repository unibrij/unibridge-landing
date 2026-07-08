// partner-portal/js/views/portalOnboardingView.js

import {
  PORTAL_ACTION
} from "../integrationPortalState.js";

import {
  PARTNER_USE_CASE_OPTIONS,
  TARGET_DESTINATION_MARKET_OPTIONS,
  MONTHLY_TRANSACTION_OPTIONS,
  MONTHLY_PROCESSING_VOLUME_OPTIONS
} from "../partnerQuestionnaireOptions.js";

import {
  PARTNER_CONTACT_COUNTRY_CODE_OPTIONS
} from "../partnerContactCountryCodes.js";

export function createPortalOnboardingView({
  shared,
  can
} = {}) {
  if (!shared) {
    throw new Error(
      "Shared portal view dependency is required."
    );
  }

  if (typeof can !== "function") {
    throw new Error(
      "Permission checker dependency is required."
    );
  }

  const {
    text,
    humanize,
    renderBadge,
    renderCard,
    renderPageHeader,
    renderEmptyState
  } = shared;

  function renderDropdownOptions(options = []) {
    return options
      .filter(([value]) => value)
      .map(([value, label]) => `
        <button
          class="country-select-option"
          type="button"
          data-dropdown-value="${text(value)}"
          data-dropdown-label="${text(label)}"
        >
          ${text(label)}
        </button>
      `)
      .join("");
  }

  function renderSingleDropdown({
    id,
    placeholder,
    options
  }) {
    return `
      <div
        class="country-select-shell"
        data-dropdown="single"
        data-placeholder="${text(placeholder)}"
      >
        <input id="${text(id)}" type="hidden" />

        <button class="country-select-trigger" type="button">
          <span class="country-select-value">
            ${text(placeholder)}
          </span>
          <span class="country-select-chevron">⌄</span>
        </button>

        <div class="country-select-menu">
          ${renderDropdownOptions(options)}
        </div>
      </div>
    `;
  }

  function renderMultiDropdown({
    placeholder,
    options
  }) {
    return `
      <div
        class="country-select-shell"
        data-dropdown="multi"
        data-placeholder="${text(placeholder)}"
      >
        <button class="country-select-trigger" type="button">
          <span class="country-select-value">
            ${text(placeholder)}
          </span>
          <span class="country-select-chevron">⌄</span>
        </button>

        <div class="country-select-menu">
          ${options
            .filter(([value]) => value)
            .map(([value, label]) => `
              <label class="country-select-option checkbox-option">
                <input
                  type="checkbox"
                  name="questionnaire-requested-corridors"
                  value="${text(value)}"
                  data-dropdown-checkbox="true"
                  data-dropdown-label="${text(label)}"
                />
                <span>${text(label)}</span>
              </label>
            `)
            .join("")}
        </div>
      </div>
    `;
  }

  function renderPhoneCountryOptions(options = []) {
    return options
      .filter(([countryCode]) => countryCode)
      .map(([countryCode, dialCode, countryName, flag]) => {
        const value =
          `${countryCode}|${dialCode}`;

        const label =
          `${flag ? `${flag} ` : ""}${countryName}${dialCode ? ` (${dialCode})` : ""}`;

        return `
          <button
            class="country-select-option"
            type="button"
            data-dropdown-value="${text(value)}"
            data-dropdown-label="${text(label)}"
          >
            ${text(label)}
          </button>
        `;
      })
      .join("");
  }

  function renderPhoneCountryDropdown() {
    const placeholder =
      "Country code";

    return `
      <div
        class="country-select-shell"
        data-dropdown="single"
        data-placeholder="${text(placeholder)}"
      >
        <input
          id="questionnaire-contact-phone-country"
          type="hidden"
        />

        <button class="country-select-trigger" type="button">
          <span class="country-select-value">
            ${text(placeholder)}
          </span>
          <span class="country-select-chevron">⌄</span>
        </button>

        <div class="country-select-menu">
          ${renderPhoneCountryOptions(PARTNER_CONTACT_COUNTRY_CODE_OPTIONS)}
        </div>
      </div>
    `;
  }

  function getQuestionnaireStatus(state) {
    return (
      state.organization?.onboarding_profile?.status ||
      state.organization?.onboarding_status ||
      "not_started"
    );
  }

  function renderContinueOrganizationForm(state) {
    if (state.organization) {
      return "";
    }

    return renderCard({
      title: "Continue existing organization",
      description:
        "Enter the owner email for your organization. If the email has access, we will send a secure portal link.",
      className: "onboarding-access-card",
      body: `
        <div class="portal-form">
          <input
            id="continue-owner-email"
            placeholder="Owner email"
            type="email"
          />

          <button
            id="continue-organization"
            class="portal-primary-button"
            type="button"
            ${state.loading ? "disabled" : ""}
          >
            Send portal link
          </button>
        </div>
      `
    });
  }

  function renderOrganizationForm(state) {
    if (state.organization) {
      return "";
    }

    return renderCard({
      title: "Create organization",
      description:
        "Create the company profile that owns applications, onboarding, KYB, pilot access, corridors, and API keys.",
      className: "onboarding-organization-card",
      body: `
        <div class="portal-form two-column-form">
          <input
            id="organization-owner-email"
            placeholder="Owner email"
            type="email"
          />

          <input
            id="organization-name"
            placeholder="Organization name"
          />

          <input
            id="organization-legal-name"
            placeholder="Legal name"
          />

          <input
            id="organization-country"
            placeholder="Country"
          />

          <input
            id="organization-website"
            placeholder="Website"
          />

          <textarea
            id="organization-business-model"
            placeholder="Business model"
          ></textarea>

          <div class="portal-form-actions">
            <button
              id="create-organization"
              class="portal-primary-button"
              type="button"
              ${state.loading || !can(PORTAL_ACTION.create_organization) ? "disabled" : ""}
            >
              Create organization
            </button>
          </div>
        </div>
      `
    });
  }

  function renderApplicationForm(state) {
    if (!state.organization || state.application) {
      return "";
    }

    return renderCard({
      title: "Create application",
      description:
        "Choose how this application will integrate with UniBridge.",
      className: "onboarding-application-card",
      body: `
        <div class="portal-form">
          <input
            id="application-name"
            placeholder="Application name"
          />

          <select id="application-integration-type">
            <option value="api">API</option>
            <option value="hosted_checkout">Hosted checkout</option>
            <option value="embedded">Embedded</option>
          </select>

          <div id="application-allowed-origins-field" hidden>
            <textarea
              id="application-allowed-origins"
              placeholder="Allowed origins, one per line"
            ></textarea>
          </div>

          <button
            id="create-application"
            class="portal-primary-button"
            type="button"
            ${state.loading || !can(PORTAL_ACTION.create_application) ? "disabled" : ""}
          >
            Create application
          </button>
        </div>
      `
    });
  }

  function renderSubmittedQuestionnaire(state) {
    const profile =
      state.organization?.onboarding_profile || {};

    return renderCard({
      title: "Onboarding questionnaire",
      description:
        "Your questionnaire has been submitted and is now available for UniBridge review.",
      className: "onboarding-submitted-card",
      actions: renderBadge("submitted"),
      body: `
        <div class="onboarding-submitted-grid">
          <div>
            <span class="portal-field-label">Use case</span>
            <strong>${text(humanize(profile.use_case || "Submitted"))}</strong>
          </div>

          <div>
            <span class="portal-field-label">Monthly transactions</span>
            <strong>${text(humanize(profile.monthly_transactions || "Not provided"))}</strong>
          </div>

          <div>
            <span class="portal-field-label">Monthly volume</span>
            <strong>${text(humanize(profile.monthly_processing_volume || "Not provided"))}</strong>
          </div>

          <div>
            <span class="portal-field-label">Compliance contact</span>
            <strong>${text(profile.compliance_contact?.email || profile.contact_email || "Not provided")}</strong>
          </div>
        </div>
      `
    });
  }

  function renderQuestionnairePanel(state) {
    if (!state.organization || !state.application) {
      return renderEmptyState({
        title: "Create an organization and application first",
        description:
          "The onboarding questionnaire becomes available after the partner organization and application are created."
      });
    }

    const status =
      getQuestionnaireStatus(state);

    if (status === "submitted") {
      return renderSubmittedQuestionnaire(state);
    }

    return renderCard({
      title: "Onboarding questionnaire",
      description:
        "Tell us how you plan to use the Partner Execution API. This is required before pilot access and API key issuance.",
      className: "onboarding-questionnaire-card",
      actions: renderBadge(status),
      body: `
        <div class="portal-form two-column-form">
          ${renderSingleDropdown({
            id: "questionnaire-use-case",
            placeholder: "Select use case",
            options: PARTNER_USE_CASE_OPTIONS
          })}

          ${renderMultiDropdown({
            placeholder: "Target destination markets",
            options: TARGET_DESTINATION_MARKET_OPTIONS
          })}

          ${renderSingleDropdown({
            id: "questionnaire-monthly-transactions",
            placeholder: "Monthly transactions",
            options: MONTHLY_TRANSACTION_OPTIONS
          })}

          ${renderSingleDropdown({
            id: "questionnaire-monthly-volume",
            placeholder: "Monthly processing volume",
            options: MONTHLY_PROCESSING_VOLUME_OPTIONS
          })}

          <input
            id="questionnaire-contact-name"
            placeholder="Compliance contact name"
          />

          <input
            id="questionnaire-contact-email"
            placeholder="Compliance contact email"
            type="email"
          />

          <input
            id="questionnaire-contact-role"
            placeholder="Compliance contact role"
          />

          <div class="phone-field">
            ${renderPhoneCountryDropdown()}

            <input
              id="questionnaire-contact-phone"
              placeholder="Phone number"
              inputmode="tel"
            />
          </div>

          <div class="portal-form-actions">
            <button
              id="submit-questionnaire"
              class="portal-primary-button"
              type="button"
              ${state.loading || !can(PORTAL_ACTION.submit_questionnaire) ? "disabled" : ""}
            >
              Submit questionnaire
            </button>
          </div>
        </div>
      `
    });
  }

  function renderOnboarding(state) {
    return `
      <div class="portal-onboarding-page">
        ${renderPageHeader({
          eyebrow: "Onboarding",
          title: "Partner onboarding",
          description:
            "Create your organization, application, and onboarding profile."
        })}

        ${
          !state.organization
            ? `
              <div class="onboarding-access-grid">
                ${renderContinueOrganizationForm(state)}
                ${renderOrganizationForm(state)}
              </div>
            `
            : ""
        }

        ${renderApplicationForm(state)}

        ${renderQuestionnairePanel(state)}
      </div>
    `;
  }

  return {
    renderOnboarding,
    renderContinueOrganizationForm,
    renderOrganizationForm,
    renderApplicationForm,
    renderQuestionnairePanel
  };
}
