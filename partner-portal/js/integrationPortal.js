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
  createIntegrationsApi({
    baseUrl:
      "https://unibridge-v2-1066944028362.us-central1.run.app/v2/integrations"
  });

let state =
  createEmptyIntegrationPortalState();

let portalNotice = "";

let outsideDropdownClickBound =
  false;

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

function getValue(id) {
  return document.getElementById(id)?.value || "";
}

function getCheckedValues(name) {
  return Array.from(
    document.querySelectorAll(
      `input[name="${name}"]:checked`
    )
  )
    .map(input => input.value)
    .filter(Boolean);
}

function parsePhoneCountry(value) {
  const [country, dialCode] =
    normalizeString(value).split("|");

  return {
    country:
      normalizeString(country),
    dial_code:
      normalizeString(dialCode)
  };
}

function getPilotEnvironmentId() {
  return state.environments.pilot?.id || "";
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
    pilot_access: null,
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
        pilot_access: null,
        production_status: null
      });
      return;
    }

    const [
      environmentsResult,
      credentialsResult,
      kybStatusResult
    ] =
      await Promise.all([
        api.listEnvironments(application.id),
        api.listCredentials(application.id),
        api.getKybStatus(organization.id).catch(() => ({}))
      ]);

    dispatch({
      type: "loaded",
      organization,
      application,
      environments:
        environmentsResult.environments || [],
      credentials:
        credentialsResult.credentials || [],
      webhooks: [],
      kyb:
        kybStatusResult.kyb || null,
      pilot_access:
        kybStatusResult.pilot_access || null,
      production_status: null
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
      pilot_access: state.pilot_access,
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

async function submitQuestionnaire() {
  const phoneCountry =
    parsePhoneCountry(
      getValue("questionnaire-contact-phone-country")
    );

  const targetDestinationMarkets =
    getCheckedValues(
      "questionnaire-requested-corridors"
    );

  const payload = {
    application_id: state.application.id,
    integration_type:
      state.application.integration_type || "api",

    use_case:
      getValue("questionnaire-use-case"),

    requested_corridors:
      targetDestinationMarkets,

    target_destination_markets:
      targetDestinationMarkets,

    expected_monthly_transactions:
      getValue("questionnaire-monthly-transactions"),

    expected_monthly_volume:
      getValue("questionnaire-monthly-volume"),

    compliance_contact: {
      name:
        getValue("questionnaire-contact-name"),

      email:
        getValue("questionnaire-contact-email"),

      role:
        getValue("questionnaire-contact-role"),

      phone_country:
        phoneCountry.country,

      phone_country_code:
        phoneCountry.dial_code,

      phone:
        getValue("questionnaire-contact-phone")
    }
  };

  await run(
    PORTAL_ACTION.submit_questionnaire,
    async () => {
      const result =
        await api.submitQuestionnaire(
          state.organization.id,
          payload
        );

      dispatch({
        type: "questionnaire_submitted",
        organization: result.organization,
        pilot_access: result.pilot_access
      });
    }
  );
}

async function issuePilotCredential() {
  await run(
    PORTAL_ACTION.issue_pilot_credential,
    async () => {
      const result =
        await api.issueCredential({
          organization_id: state.organization.id,
          application_id: state.application.id,
          environment_id: getPilotEnvironmentId(),
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

function closeAllDropdowns(exceptShell = null) {
  document
    .querySelectorAll(".country-select-shell.is-open")
    .forEach(shell => {
      if (shell !== exceptShell) {
        shell.classList.remove("is-open");
      }
    });
}

function bindSingleDropdown(shell) {
  if (shell.dataset.bound === "true") {
    return;
  }

  shell.dataset.bound =
    "true";

  const trigger =
    shell.querySelector(".country-select-trigger");

  const hiddenInput =
    shell.querySelector("input[type='hidden']");

  const valueNode =
    shell.querySelector(".country-select-value");

  const options =
    shell.querySelectorAll("[data-dropdown-value]");

  if (!trigger || !hiddenInput || !valueNode) {
    return;
  }

  trigger.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();

    const isOpen =
      shell.classList.contains("is-open");

    closeAllDropdowns(shell);

    shell.classList.toggle("is-open", !isOpen);
  });

  options.forEach(option => {
    option.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      const nextValue =
        option.dataset.dropdownValue || "";

      const nextLabel =
        option.dataset.dropdownLabel ||
        option.textContent.trim();

      hiddenInput.value =
        nextValue;

      valueNode.textContent =
        nextLabel;

      shell.classList.toggle(
        "has-value",
        Boolean(nextValue)
      );

      shell.classList.remove("is-open");
    });
  });
}

function bindMultiDropdown(shell) {
  if (shell.dataset.bound === "true") {
    return;
  }

  shell.dataset.bound =
    "true";

  const trigger =
    shell.querySelector(".country-select-trigger");

  const valueNode =
    shell.querySelector(".country-select-value");

  const menu =
    shell.querySelector(".country-select-menu");

  const checkboxes =
    shell.querySelectorAll(
      'input[type="checkbox"][data-dropdown-checkbox="true"]'
    );

  if (!trigger || !valueNode) {
    return;
  }

  const syncLabel = () => {
    const selected =
      Array.from(checkboxes)
        .filter(input => input.checked)
        .map(input => input.dataset.dropdownLabel || input.value);

    if (!selected.length) {
      valueNode.textContent =
        shell.dataset.placeholder ||
        "Select options";

      shell.classList.remove("has-value");
      return;
    }

    valueNode.textContent =
      selected.length === 1
        ? selected[0]
        : `${selected.length} selected`;

    shell.classList.add("has-value");
  };

  trigger.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();

    const isOpen =
      shell.classList.contains("is-open");

    closeAllDropdowns(shell);

    shell.classList.toggle("is-open", !isOpen);
  });

  if (menu) {
    menu.addEventListener("click", event => {
      event.stopPropagation();
    });
  }

  checkboxes.forEach(input => {
    input.addEventListener("change", syncLabel);
  });

  syncLabel();
}

function bindDropdownOutsideClick() {
  if (outsideDropdownClickBound) {
    return;
  }

  outsideDropdownClickBound =
    true;

  document.addEventListener("click", () => {
    closeAllDropdowns();
  });
}

function bindDropdowns() {
  document
    .querySelectorAll("[data-dropdown='single']")
    .forEach(bindSingleDropdown);

  document
    .querySelectorAll("[data-dropdown='multi']")
    .forEach(bindMultiDropdown);

  bindDropdownOutsideClick();
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
  bind("submit-questionnaire", submitQuestionnaire);
  bind("issue-pilot-credential", issuePilotCredential);
  bind("start-didit-kyb", startDiditKyb);
  bind("copy-secret", copySecret);

  bindApplicationTypeChange();
  bindDropdowns();

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
