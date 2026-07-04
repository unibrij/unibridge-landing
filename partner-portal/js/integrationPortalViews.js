// partner-portal/js/integrationPortalViews.js

import {
  getPortalStep,
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
        <h2>One-time secret</h2>
        <p>Copy this now. It will not be shown again.</p>
        <code class="secret-code">
          ${htmlEscape(state.one_time_secret)}
        </code>
        <div class="actions">
          <button id="copy-secret" type="button">Copy</button>
          <button id="clear-secret" type="button">Clear</button>
        </div>
      </section>
    `;
  }

  function renderSummary(state) {
    return `
      <section class="portal-card">
        <h2>Status</h2>
        <div class="status-line">
          <span class="badge">
            Step: ${htmlEscape(getPortalStep(state))}
          </span>
          <span class="badge">
            Organization: ${
              state.organization
                ? htmlEscape(state.organization.name || state.organization.id)
                : "Not created"
            }
          </span>
          <span class="badge">
            Application: ${
              state.application
                ? htmlEscape(state.application.name || state.application.id)
                : "Not created"
            }
          </span>
          <span class="badge">
            KYB: ${
              htmlEscape(
                state.organization?.kyb_status ||
                  state.kyb?.status ||
                  "not_started"
              )
            }
          </span>
          <span class="badge">
            Production access: ${
              htmlEscape(
                state.production_status?.status ||
                  state.environments.production?.status ||
                  "pending"
              )
            }
          </span>
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
          Start by creating the company profile that owns
          applications, sandbox access, webhooks, KYB, and production review.
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

  function renderSandboxPanel(state) {
    if (!state.application) {
      return "";
    }

    return `
      <section class="portal-card">
        <h2>Sandbox</h2>
        <p>
          Generate sandbox credentials and configure webhooks before
          production access is enabled.
        </p>

        <div class="status-line">
          <span class="badge">
            Sandbox env: ${
              state.environments.sandbox
                ? htmlEscape(state.environments.sandbox.status || "ready")
                : "missing"
            }
          </span>
          <span class="badge">
            Credentials: ${state.credentials.length}
          </span>
          <span class="badge">
            Webhooks: ${state.webhooks.length}
          </span>
        </div>

        <div class="actions" style="margin-top: 16px;">
          <button
            id="issue-sandbox-credential"
            type="button"
            ${state.loading || !can(PORTAL_ACTION.issue_sandbox_credential) ? "disabled" : ""}
          >
            Issue sandbox credential
          </button>
        </div>

        <div class="portal-form">
          <input id="webhook-url" placeholder="Webhook HTTPS URL" />

          <input
            id="webhook-events"
            value="payment.completed"
            placeholder="Events, comma-separated"
          />

          <button
            id="create-webhook"
            type="button"
            ${state.loading || !can(PORTAL_ACTION.create_webhook) ? "disabled" : ""}
          >
            Create webhook
          </button>
        </div>
      </section>
    `;
  }

  function renderCompliancePanel(state) {
    if (!state.organization) {
      return "";
    }

    return `
      <section class="portal-card">
        <h2>Compliance</h2>
        <p>
          Complete KYB through Didit. Once approved, UniBridge will review and
          enable production access.
        </p>

        <div class="status-line">
          <span class="badge">
            KYB: ${
              htmlEscape(
                state.organization.kyb_status ||
                  state.kyb?.status ||
                  "not_started"
              )
            }
          </span>
          <span class="badge">
            Production access: ${
              htmlEscape(
                state.production_status?.status ||
                  state.environments.production?.status ||
                  "pending"
              )
            }
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

  function renderPortal({
    state,
    portalNotice
  }) {
    return `
      ${renderError(state)}
      ${renderNotice(portalNotice)}
      ${renderSecret(state)}
      ${renderSummary(state)}
      ${renderContinueOrganizationForm(state)}
      ${renderOrganizationForm(state)}
      ${renderApplicationForm(state)}
      ${renderSandboxPanel(state)}
      ${renderCompliancePanel(state)}
    `;
  }

  return {
    renderPortal
  };
}
