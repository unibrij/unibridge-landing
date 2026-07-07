// partner-portal/js/integrationPortalViews.js

import {
  getApprovedPilotCorridors,
  getPortalStep,
  getPilotEnvironment,
  PORTAL_ACTION
} from "./integrationPortalState.js";

import {
  PARTNER_USE_CASE_OPTIONS,
  TARGET_DESTINATION_MARKET_OPTIONS,
  MONTHLY_TRANSACTION_OPTIONS,
  MONTHLY_PROCESSING_VOLUME_OPTIONS
} from "./partnerQuestionnaireOptions.js";

import {
  PARTNER_CONTACT_COUNTRY_CODE_OPTIONS
} from "./partnerContactCountryCodes.js";

import {
  renderIntegrationGuidePanel
} from "./partnerExecutionGuideView.js";

export function createIntegrationPortalViews({
  htmlEscape,
  can
} = {}) {
  if (typeof htmlEscape !== "function") {
    throw new Error(
      "htmlEscape renderer dependency is required."
    );
  }

  if (typeof can !== "function") {
    throw new Error(
      "can renderer dependency is required."
    );
  }

  function renderOptions(options = []) {
    return options
      .map(([value, label]) => `
        <option value="${htmlEscape(value)}">
          ${htmlEscape(label)}
        </option>
      `)
      .join("");
  }

  function renderCheckboxOptions(options = []) {
    return options
      .filter(([value]) => value)
      .map(([value, label]) => `
        <label class="checkbox-option">
          <input
            type="checkbox"
            name="questionnaire-requested-corridors"
            value="${htmlEscape(value)}"
          />
          <span>${htmlEscape(label)}</span>
        </label>
      `)
      .join("");
  }

  function renderCountryCodeOptions(options = []) {
    return options
      .map(([countryCode, dialCode, countryName, flag]) => {
        const value =
          countryCode
            ? `${countryCode}|${dialCode}`
            : "";

        const label =
          countryCode
            ? `${flag ? `${flag} ` : ""}${countryName}${dialCode ? ` (${dialCode})` : ""}`
            : countryName;

        return `
          <option value="${htmlEscape(value)}">
            ${htmlEscape(label)}
          </option>
        `;
      })
      .join("");
  }

  function renderError(state) {
    if (!state.error) {
      return "";
    }

    return `
      <section class="portal-card error-card">
        <h2>Error</h2>
        <p>${htmlEscape(state.error?.message || "Something went wrong.")}</p>
      </section>
    `;
  }

  function renderNotice(portalNotice) {
    if (!portalNotice) {
      return "";
    }

    return `
      <section class="portal-card">
        <h2>Check your email</h2>
        <p>${htmlEscape(portalNotice)}</p>
      </section>
    `;
  }

  function renderSecret(state) {
    if (!state.one_time_secret) {
      return "";
    }

    return `
      <section class="portal-card secret-box">
        <h2>One-time API secret</h2>
        <p>Copy this now. It will not be shown again.</p>
        <code class="secret-code">${htmlEscape(state.one_time_secret)}</code>

        <div class="actions">
          <button id="copy-secret" type="button">Copy</button>
          <button id="clear-secret" type="button">Clear</button>
        </div>
      </section>
    `;
  }

  function renderDashboard(state) {
    const step =
      getPortalStep(state);

    const pilotEnvironment =
      getPilotEnvironment(state);

    const approvedCorridors =
      getApprovedPilotCorridors(state);

    const kybStatus =
      state.organization?.kyb_status ||
      state.kyb?.status ||
      "not_started";

    return `
      <section class="portal-card">
        <h2>Dashboard</h2>

        <div class="portal-metrics">
          <div class="metric-card">
            <span>Current step</span>
            <strong>${htmlEscape(step)}</strong>
          </div>

          <div class="metric-card">
            <span>Organization</span>
            <strong>
              ${
                state.organization
                  ? htmlEscape(state.organization.name || state.organization.id)
                  : "Not created"
              }
            </strong>
          </div>

          <div class="metric-card">
            <span>Application</span>
            <strong>
              ${
                state.application
                  ? htmlEscape(state.application.name || state.application.id)
                  : "Not created"
              }
            </strong>
          </div>

          <div class="metric-card">
            <span>KYB</span>
            <strong>${htmlEscape(kybStatus)}</strong>
          </div>

          <div class="metric-card">
            <span>Pilot access</span>
            <strong>
              ${htmlEscape(
                pilotEnvironment?.status ||
                  state.pilot_access?.status ||
                  "pending"
              )}
            </strong>
          </div>

          <div class="metric-card">
            <span>Approved corridors</span>
            <strong>${approvedCorridors.length}</strong>
          </div>
        </div>

        <div class="actions" style="margin-top: 16px;">
          <button id="refresh-portal" type="button">
            Refresh
          </button>
        </div>
      </section>
    `;
  }

  function renderContinueOrganizationForm(state) {
    if (state.organization) {
      return "";
    }

    return `
      <section class="portal-card">
        <h2>Continue existing organization</h2>
        <p>
          Enter the owner email for your organization. If the email has access,
          we will send a secure portal link.
        </p>

        <div class="portal-form">
          <input
            id="continue-owner-email"
            placeholder="Owner email"
            type="email"
          />

          <button
            id="continue-organization"
            type="button"
            ${state.loading ? "disabled" : ""}
          >
            Send portal link
          </button>
        </div>
      </section>
    `;
  }

  function renderOrganizationForm(state) {
    if (state.organization) {
      return "";
    }

    return `
      <section class="portal-card">
        <h2>Create organization</h2>
        <p>
          Create the company profile that owns applications,
          onboarding, KYB, pilot access, corridors, and API keys.
        </p>

        <div class="portal-form">
          <input
            id="organization-owner-email"
            placeholder="Owner email"
            type="email"
          />
          <input id="organization-name" placeholder="Organization name" />
          <input id="organization-legal-name" placeholder="Legal name" />
          <input id="organization-country" placeholder="Country" />
          <input id="organization-website" placeholder="Website" />

          <textarea
            id="organization-business-model"
            placeholder="Business model"
          ></textarea>

          <button
            id="create-organization"
            type="button"
            ${state.loading || !can(PORTAL_ACTION.create_organization) ? "disabled" : ""}
          >
            Create organization
          </button>
        </div>
      </section>
    `;
  }

  function renderApplicationForm(state) {
    if (!state.organization || state.application) {
      return "";
    }

    return `
      <section class="portal-card">
        <h2>Create application</h2>
        <p>
          Choose how this application will integrate with UniBridge.
        </p>

        <div class="portal-form">
          <input id="application-name" placeholder="Application name" />

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
            type="button"
            ${state.loading || !can(PORTAL_ACTION.create_application) ? "disabled" : ""}
          >
            Create application
          </button>
        </div>
      </section>
    `;
  }

  function renderQuestionnairePanel(state) {
    if (!state.organization || !state.application) {
      return "";
    }

    const status =
      state.organization?.onboarding_profile?.status ||
      state.organization?.onboarding_status ||
      "not_started";

    if (status === "submitted") {
      return `
        <section class="portal-card">
          <h2>Onboarding questionnaire</h2>
          <p>The onboarding questionnaire has been submitted.</p>
          <span class="badge">Status: submitted</span>
        </section>
      `;
    }

    return `
      <section class="portal-card">
        <h2>Onboarding questionnaire</h2>
        <p>
          Tell us how you plan to use the Partner Execution API.
          This is required before pilot access and API key issuance.
        </p>

        <div class="portal-form two-column-form">
          <select id="questionnaire-use-case">
            ${renderOptions(PARTNER_USE_CASE_OPTIONS)}
          </select>

          <div class="checkbox-list">
            <div class="checkbox-list-title">
              Target destination markets
            </div>
            ${renderCheckboxOptions(TARGET_DESTINATION_MARKET_OPTIONS)}
          </div>

          <select id="questionnaire-monthly-transactions">
            ${renderOptions(MONTHLY_TRANSACTION_OPTIONS)}
          </select>

          <select id="questionnaire-monthly-volume">
            ${renderOptions(MONTHLY_PROCESSING_VOLUME_OPTIONS)}
          </select>

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
            <select id="questionnaire-contact-phone-country">
              ${renderCountryCodeOptions(PARTNER_CONTACT_COUNTRY_CODE_OPTIONS)}
            </select>

            <input
              id="questionnaire-contact-phone"
              placeholder="Phone number"
              inputmode="tel"
            />
          </div>

          <button
            id="submit-questionnaire"
            type="button"
            ${state.loading || !can(PORTAL_ACTION.submit_questionnaire) ? "disabled" : ""}
          >
            Submit questionnaire
          </button>
        </div>
      </section>
    `;
  }

  function renderKybStatusPanel(state) {
    if (!state.organization) {
      return "";
    }

    const kybStatus =
      state.organization?.kyb_status ||
      state.kyb?.status ||
      "not_started";

    return `
      <section class="portal-card">
        <h2>KYB status</h2>
        <p>
          KYB must be submitted before pilot API keys can be issued.
          Full KYB approval is required later for production access.
        </p>

        <div class="status-line">
          <span class="badge">
            KYB: ${htmlEscape(kybStatus)}
          </span>
        </div>

        <div class="actions" style="margin-top: 16px;">
          <button
            id="start-didit-kyb"
            type="button"
            ${state.loading || !can(PORTAL_ACTION.start_didit_kyb) ? "disabled" : ""}
          >
            Start KYB
          </button>
        </div>
      </section>
    `;
  }

  function renderPilotAccessPanel(state) {
    if (!state.application) {
      return "";
    }

    const pilotEnvironment =
      getPilotEnvironment(state);

    return `
      <section class="portal-card">
        <h2>Pilot access</h2>
        <p>
          Pilot access is enabled by UniBridge after onboarding review,
          KYB submission, and corridor approval.
        </p>

        <div class="status-line">
          <span class="badge">
            Pilot environment:
            ${htmlEscape(pilotEnvironment?.status || "pending")}
          </span>

          <span class="badge">
            Environment ID:
            ${htmlEscape(pilotEnvironment?.id || "not_available")}
          </span>
        </div>
      </section>
    `;
  }

  function renderApprovedCorridorsPanel(state) {
    if (!state.organization) {
      return "";
    }

    const corridors =
      getApprovedPilotCorridors(state);

    const requested =
      state.organization?.requested_corridors || [];

    return `
      <section class="portal-card">
        <h2>Approved corridors</h2>
        <p>
          Only approved pilot corridors can be used with pilot API keys.
        </p>

        ${
          corridors.length
            ? `
              <div class="corridor-grid">
                ${corridors.map(corridor => `
                  <div class="dashboard-card">
                    <strong>
                      ${htmlEscape(
                        corridor.corridor ||
                          corridor.destination_country ||
                          corridor.receiver_country ||
                          corridor.country ||
                          String(corridor)
                      )}
                    </strong>
                    <span>pilot approved</span>
                  </div>
                `).join("")}
              </div>
            `
            : `
              <p>No corridors approved for pilot yet.</p>
              ${
                requested.length
                  ? `
                    <div class="summary-list">
                      ${requested.map(corridor => `
                        <span class="badge">
                          ${htmlEscape(
                            corridor.corridor ||
                              corridor.destination_country ||
                              corridor.receiver_country ||
                              corridor.country ||
                              String(corridor)
                          )}
                        </span>
                      `).join("")}
                    </div>
                  `
                  : ""
              }
            `
        }
      </section>
    `;
  }

  function renderApiKeysPanel(state) {
    if (!state.application) {
      return "";
    }

    const credentials =
      Array.isArray(state.credentials)
        ? state.credentials
        : [];

    return `
      <section class="portal-card">
        <h2>API keys</h2>
        <p>
          Issue a pilot API key after questionnaire submission,
          KYB submission, pilot enablement, and corridor approval.
        </p>

        <div class="status-line">
          <span class="badge">
            Keys: ${credentials.length}
          </span>
        </div>

        <div class="actions" style="margin-top: 16px;">
          <button
            id="issue-pilot-credential"
            type="button"
            ${state.loading || !can(PORTAL_ACTION.issue_pilot_credential) ? "disabled" : ""}
          >
            Issue pilot API key
          </button>
        </div>

        ${
          credentials.length
            ? `
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Key</th>
                      <th>Status</th>
                      <th>Environment</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${credentials.map(credential => `
                      <tr>
                        <td>${htmlEscape(credential.key_prefix || credential.name || credential.id || "API key")}</td>
                        <td>${htmlEscape(credential.status || "active")}</td>
                        <td>${htmlEscape(credential.environment_id || "pilot")}</td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>
            `
            : ""
        }
      </section>
    `;
  }

  function renderPortal({
    state,
    portalNotice
  }) {
    return `
      ${renderError(state)}
      ${renderNotice(portalNotice)}
      ${renderSecret(state)}
      ${renderDashboard(state)}
      ${renderContinueOrganizationForm(state)}
      ${renderOrganizationForm(state)}
      ${renderApplicationForm(state)}
      ${renderQuestionnairePanel(state)}
      ${renderKybStatusPanel(state)}
      ${renderPilotAccessPanel(state)}
      ${renderApprovedCorridorsPanel(state)}
      ${renderApiKeysPanel(state)}
      ${renderIntegrationGuidePanel({ state })}
    `;
  }

  return {
    renderPortal
  };
}
