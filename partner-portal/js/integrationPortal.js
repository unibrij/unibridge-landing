// partner-portal/js/integrationPortal.js

import {
  createIntegrationsApi
} from "./integrationsApi.js";

import {
  requestPortalLink,
  verifyPortalToken
} from "./portalAuth.js";

import {
  readStoredOrganizationId,
  storeOrganizationId
} from "./portalStorage.js";

import {
  normalizeString,
  pickFirst
} from "./portalUtils.js";

import {
  createIntegrationPortalViews
} from "./integrationPortalViews.js";

import {
  PORTAL_ACTION,
  canRunPortalAction,
  createEmptyIntegrationPortalState,
  reduceIntegrationPortalState
} from "./integrationPortalState.js";

const root =
  document.getElementById("portal-root");

const api =
  createIntegrationsApi();

let state =
  createEmptyIntegrationPortalState();

let portalNotice = "";

function htmlEscape(value) {
  return normalizeString(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function can(action) {
  return canRunPortalAction(state, action);
}

const views =
  createIntegrationPortalViews({
    htmlEscape,
    can
  });

function dispatch(event) {
  state =
    reduceIntegrationPortalState(state, event);

  render();
}

function linesToArray(value) {
  return normalizeString(value)
    .split("\n")
    .map(item => item.trim())
    .filter(Boolean);
}

function csvToArray(value) {
  return normalizeString(value)
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

async function run(action, handler) {
  if (!can(action)) {
    return;
  }

  portalNotice = "";
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

function dispatchEmptyLoaded() {
  dispatch({
    type: "loaded",
    organization: null,
    application: null,
    environments: [],
    credentials: [],
    webhooks: [],
    kyb: null,
    production_status: null
  });
}

async function loadPortal() {
  dispatch({ type: "loading" });

  try {
    const organizationId =
      readStoredOrganizationId();

    const organizationsResult =
      await api.listOrganizations(organizationId);

    const organization =
      pickFirst(organizationsResult.organizations);

    if (!organization) {
      dispatchEmptyLoaded();
      return;
    }

    storeOrganizationId(organization.id);

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
        webhooks: [],
        kyb: null,
        production_status: null
      });
      return;
    }

    const [
      environmentsResult,
      credentialsResult,
      webhooksResult,
      kybStatusResult,
      productionStatusResult
    ] =
      await Promise.all([
        api.listEnvironments(application.id),
        api.listCredentials(application.id),
        api.listWebhooks(application.id),
        api.getKybStatus(organization.id).catch(() => ({})),
        api.getProductionStatus(organization.id).catch(() => ({}))
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
        webhooksResult.webhooks || [],
      kyb:
        kybStatusResult.kyb || null,
      production_status:
        productionStatusResult.production_status || null
    });
  } catch (error) {
    dispatch({
      type: "error",
      error
    });
  }
}

async function verifyPortalTokenOnBootstrap() {
  dispatch({ type: "loading" });

  try {
    const result =
      await verifyPortalToken({
        api
      });

    if (!result.handled) {
      return false;
    }

    if (result.organization?.id) {
      storeOrganizationId(result.organization.id);
    }

    await loadPortal();

    return true;
  } catch (error) {
    dispatch({
      type: "error",
      error
    });

    return true;
  }
}

async function continuePortalSession() {
  const ownerEmail =
    getValue("continue-owner-email");

  portalNotice = "";
  dispatch({ type: "loading" });

  try {
    const result =
      await requestPortalLink({
        api,
        ownerEmail
      });

    portalNotice =
      result.message ||
      "If this email has access, we sent a portal link.";

    dispatch({
      type: "loaded",
      organization: state.organization,
      application: state.application,
      environments: state.environments,
      credentials: state.credentials,
      webhooks: state.webhooks,
      kyb: state.kyb,
      production_status: state.production_status
    });
  } catch (error) {
    dispatch({
      type: "error",
      error
    });
  }
}

async function createOrganization() {
  const payload = {
    owner_email: getValue("organization-owner-email"),
    name: getValue("organization-name"),
    legal_name: getValue("organization-legal-name"),
    country: getValue("organization-country"),
    website: getValue("organization-website"),
    business_model:
      getValue("organization-business-model")
  };

  await run(
    PORTAL_ACTION.create_organization,
    async () => {
      const result =
        await api.createOrganization(payload);

      storeOrganizationId(
        result.organization?.id
      );

      dispatch({
        type: "organization_created",
        organization: result.organization
      });
    }
  );
}

async function createApplication() {
  const integrationType =
    getValue("application-integration-type");

  const payload = {
    organization_id: state.organization.id,
    name: getValue("application-name"),
    integration_type: integrationType,
    allowed_origins:
      integrationType === "embedded"
        ? linesToArray(
            getValue("application-allowed-origins")
          )
        : []
  };

  await run(
    PORTAL_ACTION.create_application,
    async () => {
      const result =
        await api.createApplication(payload);

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
  const payload = {
    organization_id: state.organization.id,
    application_id: state.application.id,
    environment_id: getSandboxEnvironmentId(),
    url: getValue("webhook-url"),
    events:
      csvToArray(getValue("webhook-events"))
  };

  await run(
    PORTAL_ACTION.create_webhook,
    async () => {
      const result =
        await api.createWebhook(payload);

      dispatch({
        type: "webhook_created",
        webhook: result.webhook,
        signing_secret: result.signing_secret
      });
    }
  );
}

async function startDiditKyb() {
  await run(
    PORTAL_ACTION.start_didit_kyb,
    async () => {
      const result =
        await api.startDiditKyb({
          organization_id: state.organization.id
        });

      dispatch({
        type: "kyb_started",
        kyb: result.kyb,
        organization: result.organization
      });

      const verificationUrl =
        result.verification_url ||
        result.redirect_url ||
        result.url;

      if (verificationUrl) {
        window.location.href = verificationUrl;
      }
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

function bindApplicationTypeChange() {
  const select =
    document.getElementById("application-integration-type");

  const field =
    document.getElementById("application-allowed-origins-field");

  if (!select || !field) {
    return;
  }

  const sync = () => {
    field.hidden =
      select.value !== "embedded";
  };

  select.addEventListener("change", sync);
  sync();
}

function render() {
  if (!root) {
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

  root.innerHTML =
    views.renderPortal({
      state,
      portalNotice
    });

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
  bind("continue-organization", continuePortalSession);
  bind("create-organization", createOrganization);
  bind("create-application", createApplication);
  bind("issue-sandbox-credential", issueSandboxCredential);
  bind("create-webhook", createWebhook);
  bind("start-didit-kyb", startDiditKyb);
  bind("copy-secret", copySecret);
  bindApplicationTypeChange();

  bind("clear-secret", () => {
    dispatch({ type: "clear_secret" });
  });
}

async function bootstrapPortal() {
  if (!root) {
    return;
  }

  const handledPortalToken =
    await verifyPortalTokenOnBootstrap();

  if (!handledPortalToken) {
    loadPortal();
  }
}

bootstrapPortal();
