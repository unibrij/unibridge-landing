// partner-portal/js/integrationPortal.js

import {
  createIntegrationsApi
} from "./integrationsApi.js";

import {
  getPartnerPortalSession,
  isUnauthorizedSessionError
} from "./session.js";

import {
  PORTAL_ACTION,
  canRunPortalAction,
  createEmptyIntegrationPortalState,
  getPortalStep,
  reduceIntegrationPortalState
} from "./integrationPortalState.js";

const root =
  document.getElementById("portal-root");

const api =
  createIntegrationsApi();

let state =
  createEmptyIntegrationPortalState();

let session =
  null;

let locked =
  false;

function dispatch(event) {
  state =
    reduceIntegrationPortalState(state, event);

  render();
}

function htmlEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getErrorMessage(error) {
  return htmlEscape(
    error?.message ||
      "Something went wrong."
  );
}

function pickFirst(value) {
  return Array.isArray(value) && value.length
    ? value[0]
    : null;
}

function linesToArray(value) {
  return String(value || "")
    .split("\n")
    .map(item => item.trim())
    .filter(Boolean);
}

function csvToArray(value) {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function getValue(id) {
  return document.getElementById(id)?.value || "";
}

function getSandboxEnvironmentId() {
  return state.environments.sandbox?.id || "";
}

function getProductionEnvironmentId() {
  return state.environments.production?.id || "";
}

function can(action) {
  return canRunPortalAction(state, action);
}

async function run(action, handler) {
  if (locked || !can(action)) {
    return;
  }

  dispatch({ type: "loading" });

  try {
    await handler();
  } catch (error) {
    dispatch({
      type: "error",
      error
    });
  }
}

async function loadPortal() {
  dispatch({ type: "loading" });

  try {
    const organizationsResult =
      await api.listOrganizations();

    const organization =
      pickFirst(organizationsResult.organizations);

    if (!organization) {
      dispatch({
        type: "loaded",
        organization: null,
        application: null,
        environments: [],
        credentials: [],
        webhooks: []
      });
      return;
    }

    const applicationsResult =
      await api.listApplications(organization.id);

    const application =
      pickFirst(applicationsResult.applications);

    if (!application) {
      dispatch({
        type: "loaded",
        organization,
        application: null,
        environments: [],
        credentials: [],
        webhooks: []
      });
      return;
    }

    const [
      environmentsResult,
      credentialsResult,
      webhooksResult
    ] =
      await Promise.all([
        api.listEnvironments(application.id),
        api.listCredentials(application.id),
        api.listWebhooks(application.id)
      ]);

    dispatch({
      type: "loaded",
      organization,
      application,
      environments:
        environmentsResult.environments || [],
      credentials:
        credentialsResult.credentials || [],
      webhooks:
        webhooksResult.webhooks || []
    });
  } catch (error) {
    dispatch({
      type: "error",
      error
    });
  }
}

async function createOrganization() {
  await run(
    PORTAL_ACTION.create_organization,
    async () => {
      const result =
        await api.createOrganization({
          name: getValue("organization-name"),
          legal_name: getValue("organization-legal-name"),
          country: getValue("organization-country"),
          website: getValue("organization-website"),
          business_model:
            getValue("organization-business-model")
        });

      dispatch({
        type: "organization_created",
        organization: result.organization
      });
    }
  );
}

async function createApplication() {
  await run(
    PORTAL_ACTION.create_application,
    async () => {
      const result =
        await api.createApplication({
          organization_id: state.organization.id,
          name: getValue("application-name"),
          integration_type:
            getValue("application-integration-type"),
          allowed_origins:
            linesToArray(
              getValue("application-allowed-origins")
            ),
          redirect_urls:
            linesToArray(
              getValue("application-redirect-urls")
            )
        });

      dispatch({
        type: "application_created",
        application: result.application,
        environments: result.environments
      });
    }
  );
}

async function issueSandboxCredential() {
  await run(
    PORTAL_ACTION.issue_sandbox_credential,
    async () => {
      const result =
        await api.issueCredential({
          organization_id: state.organization.id,
          application_id: state.application.id,
          environment_id: getSandboxEnvironmentId(),
          type: "secret"
        });

      dispatch({
        type: "credential_issued",
        credential: result.credential,
        secret: result.secret
      });
    }
  );
}

async function createWebhook() {
  await run(
    PORTAL_ACTION.create_webhook,
    async () => {
      const result =
        await api.createWebhook({
          organization_id: state.organization.id,
          application_id: state.application.id,
          environment_id: getSandboxEnvironmentId(),
          url: getValue("webhook-url"),
          events:
            csvToArray(getValue("webhook-events"))
        });

      dispatch({
        type: "webhook_created",
        webhook: result.webhook,
        signing_secret: result.signing_secret
      });
    }
  );
}

async function submitKyb() {
  await run(
    PORTAL_ACTION.submit_kyb,
    async () => {
      const organization =
        await api.submitKyb({
          organization_id: state.organization.id
        });

      dispatch({
        type: "kyb_updated",
        organization
      });
    }
  );
}

async function requestGoLive() {
  await run(
    PORTAL_ACTION.request_go_live,
    async () => {
      const result =
        await api.requestGoLive({
          organization_id: state.organization.id,
          environment_id: getProductionEnvironmentId()
        });

      dispatch({
        type: "go_live_updated",
        organization: result.organization,
        environment: result.environment
      });
    }
  );
}

async function copySecret() {
  if (!state.one_time_secret) {
    return;
  }

  try {
    await navigator.clipboard.writeText(
      state.one_time_secret
    );

    const button =
      document.getElementById("copy-secret");

    if (button) {
      button.textContent = "Copied";
    }
  } catch {
    window.prompt(
      "Copy this secret:",
      state.one_time_secret
    );
  }
}

function renderLocked() {
  return `
    <section class="portal-card">
      <h2>Partner Portal locked</h2>
      <p>
        Please sign in with your partner account to continue.
      </p>
      <div class="actions">
        <a class="docs-link" href="/partner-docs/">
          Go to Partner Docs
        </a>
      </div>
    </section>
  `;
}

function renderError() {
  if (!state.error) {
    return "";
  }

  return `
    <section class="portal-card error-card">
      <h2>Error</h2>
      <p>${getErrorMessage(state.error)}</p>
    </section>
  `;
}

function renderSecret() {
  if (!state.one_time_secret) {
    return "";
  }

  return `
    <section class="portal-card secret-box">
      <h2>One-time secret</h2>
      <p>
        Copy this now. It will not be shown again.
      </p>
      <code class="secret-code">
        ${htmlEscape(state.one_time_secret)}
      </code>
      <div class="actions">
        <button id="copy-secret" type="button">
          Copy
        </button>
        <button id="clear-secret" type="button">
          Clear
        </button>
      </div>
    </section>
  `;
}

function renderSummary() {
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
                "not_started"
            )
          }
        </span>
        <span class="badge">
          Go Live: ${
            htmlEscape(
              state.organization?.go_live_status ||
                "not_requested"
            )
          }
        </span>
        <span class="badge">
          User: ${
            session?.user?.email
              ? htmlEscape(session.user.email)
              : "Session active"
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

function renderOrganizationForm() {
  if (state.organization) {
    return "";
  }

  return `
    <section class="portal-card">
      <h2>Create organization</h2>
      <p>
        Start by creating the company profile that owns
        applications, sandbox access, webhooks, KYB, and Go Live.
      </p>

      <div class="portal-form">
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

function renderApplicationForm() {
  if (!state.organization || state.application) {
    return "";
  }

  return `
    <section class="portal-card">
      <h2>Create application</h2>
      <p>
        Applications define allowed origins, redirect URLs,
        and the integration type.
      </p>

      <div class="portal-form">
        <input id="application-name" placeholder="Application name" />

        <select id="application-integration-type">
          <option value="api">API</option>
          <option value="hosted_checkout">Hosted checkout</option>
          <option value="embedded">Embedded</option>
        </select>

        <textarea
          id="application-allowed-origins"
          placeholder="Allowed origins, one per line"
        ></textarea>

        <textarea
          id="application-redirect-urls"
          placeholder="Redirect URLs, one per line"
        ></textarea>

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

function renderSandboxPanel() {
  if (!state.application) {
    return "";
  }

  return `
    <section class="portal-card">
      <h2>Sandbox</h2>
      <p>
        Generate sandbox credentials and configure webhooks before
        requesting production access.
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
        <input
          id="webhook-url"
          placeholder="Webhook HTTPS URL"
        />

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

function renderCompliancePanel() {
  if (!state.organization) {
    return "";
  }

  return `
    <section class="portal-card">
      <h2>Compliance</h2>
      <p>
        Submit KYB, then request Go Live when production access is ready.
      </p>

      <div class="status-line">
        <span class="badge">
          KYB: ${
            htmlEscape(
              state.organization.kyb_status ||
                "not_started"
            )
          }
        </span>
        <span class="badge">
          Go Live: ${
            htmlEscape(
              state.organization.go_live_status ||
                "not_requested"
            )
          }
        </span>
        <span class="badge">
          Production env: ${
            state.environments.production
              ? htmlEscape(state.environments.production.status || "locked")
              : "missing"
          }
        </span>
      </div>

      <div class="actions" style="margin-top: 16px;">
        <button
          id="submit-kyb"
          type="button"
          ${state.loading || !can(PORTAL_ACTION.submit_kyb) ? "disabled" : ""}
        >
          Submit KYB
        </button>

        <button
          id="request-go-live"
          type="button"
          ${state.loading || !can(PORTAL_ACTION.request_go_live) ? "disabled" : ""}
        >
          Request Go Live
        </button>
      </div>
    </section>
  `;
}

function render() {
  if (!root) {
    return;
  }

  if (locked) {
    root.innerHTML = renderLocked();
    return;
  }

  if (!state.loaded && state.loading) {
    root.innerHTML = `
      <div class="loading-card">
        Loading partner portal…
      </div>
    `;
    return;
  }

  root.innerHTML = `
    ${renderError()}
    ${renderSecret()}
    ${renderSummary()}
    ${renderOrganizationForm()}
    ${renderApplicationForm()}
    ${renderSandboxPanel()}
    ${renderCompliancePanel()}
  `;

  bindEvents();
}

function bind(id, handler) {
  const element =
    document.getElementById(id);

  if (element) {
    element.addEventListener("click", handler);
  }
}

function bindEvents() {
  bind("refresh-portal", loadPortal);
  bind("create-organization", createOrganization);
  bind("create-application", createApplication);
  bind("issue-sandbox-credential", issueSandboxCredential);
  bind("create-webhook", createWebhook);
  bind("submit-kyb", submitKyb);
  bind("request-go-live", requestGoLive);
  bind("copy-secret", copySecret);

  bind("clear-secret", () => {
    dispatch({ type: "clear_secret" });
  });
}

async function bootstrapPortal() {
  if (!root) {
    return;
  }

  try {
    session =
      await getPartnerPortalSession();

    locked = false;

    await loadPortal();
  } catch (error) {
    if (isUnauthorizedSessionError(error)) {
      locked = true;
      render();
      return;
    }

    dispatch({
      type: "error",
      error
    });
  }
}

bootstrapPortal();
