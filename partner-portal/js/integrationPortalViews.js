// partner-portal/js/integrationPortalViews.js

import {
  getApprovedPilotCorridors,
  getPortalStep,
  getPilotEnvironment,
  PORTAL_ACTION
} from "./integrationPortalState.js";

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
            <option value="">Select use case</option>
            <option value="pay_with_unibridge">Pay with UniBridge</option>
            <option value="payouts">Payouts</option>
            <option value="marketplace">Marketplace</option>
            <option value="treasury">Treasury</option>
            <option value="other">Other</option>
          </select>

          <input
            id="questionnaire-requested-corridors"
            placeholder="Requested corridors, e.g. BR, PH"
          />

          <input
            id="questionnaire-source-countries"
            placeholder="Source countries, e.g. US, GB, EU"
          />

          <input
            id="questionnaire-payout-methods"
            placeholder="Payout methods, e.g. pix, bank_transfer"
          />

          <input
            id="questionnaire-monthly-volume"
            placeholder="Expected monthly volume"
            type="number"
          />

          <input
            id="questionnaire-transaction-size"
            placeholder="Expected transaction size"
            type="number"
          />

          <select id="questionnaire-settlement-preference">
            <option value="">Settlement preference</option>
            <option value="stablecoin">Stablecoin</option>
            <option value="fiat">Fiat</option>
            <option value="both">Both</option>
            <option value="unknown">Unknown</option>
          </select>

          <select id="questionnaire-webhook-readiness">
            <option value="">Webhook readiness</option>
            <option value="ready">Ready</option>
            <option value="planned">Planned</option>
            <option value="not_ready">Not ready</option>
            <option value="not_required">Not required</option>
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

          <input
            id="questionnaire-contact-phone"
            placeholder="Compliance contact phone"
          />

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

  function renderIntegrationGuidePanel(state) {
    if (!state.application) {
      return "";
    }

    const apiBaseUrl =
      "https://unibridge-v2-1066944028362.us-central1.run.app";

    return `
      <section class="portal-card">
        <h2>Integration guide</h2>
        <p>
          Use the Partner Execution API with your pilot API key.
          The corridor is derived from receiver_country,
          destination_country, or route context.
        </p>

        <h3>1. Register session</h3>
        <pre class="code-block"><code>curl -X POST ${apiBaseUrl}/v2/integrations/execution/session/register \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_PILOT_API_KEY" \\
  -d '{
    "receiver_country": "BR",
    "source_country": "US",
    "source_currency": "USD",
    "amount": 25,
    "partner_reference": "demo-session-001"
  }'</code></pre>

        <p>Save the returned <code>session_id</code>.</p>

        <h3>2. Resolve session</h3>
        <pre class="code-block"><code>curl -X POST ${apiBaseUrl}/v2/integrations/execution/session/resolve \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_PILOT_API_KEY" \\
  -d '{
    "session_id": "SESSION_ID"
  }'</code></pre>

        <h3>3. Quote</h3>
        <pre class="code-block"><code>curl -X POST ${apiBaseUrl}/v2/integrations/execution/session/quote \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_PILOT_API_KEY" \\
  -d '{
    "session_id": "SESSION_ID",
    "amount": 25
  }'</code></pre>

        <p>Save the returned <code>route_id</code>.</p>

        <h3>4. Create settlement</h3>
        <pre class="code-block"><code>curl -X POST ${apiBaseUrl}/v2/integrations/execution/settlement/create \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_PILOT_API_KEY" \\
  -d '{
    "session_id": "SESSION_ID",
    "route_id": "ROUTE_ID_FROM_QUOTE",
    "destination": {
      "pix": "receiver@example.com"
    },
    "redirect_url": "https://partner.example.com/return"
  }'</code></pre>

        <p>
          Save the returned <code>settlement_id</code> and
          <code>funding_session_id</code>.
        </p>

        <h3>5. Create funding</h3>
        <pre class="code-block"><code>curl -X POST ${apiBaseUrl}/v2/integrations/execution/funding/create \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_PILOT_API_KEY" \\
  -d '{
    "settlement_id": "SETTLEMENT_ID",
    "redirect_url": "https://partner.example.com/return"
  }'</code></pre>

        <h3>6. Create or refresh funding session</h3>
        <pre class="code-block"><code>curl -X POST ${apiBaseUrl}/v2/integrations/execution/funding/session \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_PILOT_API_KEY" \\
  -d '{
    "settlement_id": "SETTLEMENT_ID",
    "redirect_url": "https://partner.example.com/return"
  }'</code></pre>

        <p>
          Save the returned <code>funding_session_id</code> if returned.
        </p>

        <h3>7. Check funding address state</h3>
        <pre class="code-block"><code>curl -X POST ${apiBaseUrl}/v2/integrations/execution/funding/address-state \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_PILOT_API_KEY" \\
  -d '{
    "settlement_id": "SETTLEMENT_ID"
  }'</code></pre>

        <h3>8. Recover funding session</h3>
        <pre class="code-block"><code>curl -X POST ${apiBaseUrl}/v2/integrations/execution/funding/recover \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_PILOT_API_KEY" \\
  -d '{
    "settlement_id": "SETTLEMENT_ID"
  }'</code></pre>

        <h3>9. Confirm settlement</h3>
        <pre class="code-block"><code>curl -X POST ${apiBaseUrl}/v2/integrations/execution/settlement/confirm \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_PILOT_API_KEY" \\
  -d '{
    "settlement_id": "SETTLEMENT_ID"
  }'</code></pre>

        <h3>10. Check settlement status</h3>
        <pre class="code-block"><code>curl "${apiBaseUrl}/v2/integrations/execution/settlement/status?settlement_id=SETTLEMENT_ID" \\
  -H "Authorization: Bearer YOUR_PILOT_API_KEY"</code></pre>

        <pre class="code-block"><code>curl "${apiBaseUrl}/v2/integrations/execution/settlement/status?session_id=SESSION_ID" \\
  -H "Authorization: Bearer YOUR_PILOT_API_KEY"</code></pre>

        <p>
          Destination schema depends on the selected route.
          For BR PIX, use:
          <code>{ "pix": "receiver@example.com" }</code>.
        </p>
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
      ${renderIntegrationGuidePanel(state)}
    `;
  }

  return {
    renderPortal
  };
}
