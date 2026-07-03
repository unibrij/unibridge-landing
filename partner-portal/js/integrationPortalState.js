// partner-portal/js/integrationPortalState.js

const EMPTY_LIST = Object.freeze([]);

export const PORTAL_STEP = {
  organization: "organization",
  application: "application",
  sandbox: "sandbox",
  webhooks: "webhooks",
  kyb: "kyb",
  production_status: "production_status",
  production: "production"
};

export const PORTAL_ACTION = {
  create_organization: "create_organization",
  create_application: "create_application",
  issue_sandbox_credential: "issue_sandbox_credential",
  create_webhook: "create_webhook",
  start_didit_kyb: "start_didit_kyb"
};

function normalizeString(value) {
  return String(value || "").trim();
}

function asArray(value) {
  return Array.isArray(value)
    ? value
    : EMPTY_LIST;
}

function findEnvironment(environments = {}, type) {
  if (Array.isArray(environments)) {
    return environments.find(
      environment => environment?.type === type
    ) || null;
  }

  return environments?.[type] || null;
}

function hasId(record) {
  return Boolean(normalizeString(record?.id));
}

function isApproved(value) {
  return value === "approved";
}

function isProductionEnabled(environment = {}) {
  return environment?.status === "production_enabled";
}

export function createEmptyIntegrationPortalState() {
  return {
    organization: null,
    application: null,

    environments: {
      sandbox: null,
      production: null
    },

    credentials: [],
    webhooks: [],

    kyb: null,
    production_status: null,

    selected_environment_type: "sandbox",

    one_time_secret: null,
    error: null,
    loading: false,
    loaded: false
  };
}

export function normalizeIntegrationPortalState(input = {}) {
  const environments = input.environments || {};

  return {
    ...createEmptyIntegrationPortalState(),

    ...input,

    organization:
      input.organization || null,

    application:
      input.application || null,

    environments: {
      sandbox:
        findEnvironment(environments, "sandbox"),

      production:
        findEnvironment(environments, "production")
    },

    credentials:
      asArray(input.credentials),

    webhooks:
      asArray(input.webhooks),

    kyb:
      input.kyb || null,

    production_status:
      input.production_status || null,

    selected_environment_type:
      normalizeString(input.selected_environment_type) ||
      "sandbox",

    one_time_secret:
      input.one_time_secret || null,

    error:
      input.error || null,

    loading:
      input.loading === true,

    loaded:
      input.loaded === true
  };
}

export function getSelectedEnvironment(state = {}) {
  const normalized =
    normalizeIntegrationPortalState(state);

  return (
    normalized.environments[
      normalized.selected_environment_type
    ] || null
  );
}

export function getPortalStep(state = {}) {
  const normalized =
    normalizeIntegrationPortalState(state);

  if (!hasId(normalized.organization)) {
    return PORTAL_STEP.organization;
  }

  if (!hasId(normalized.application)) {
    return PORTAL_STEP.application;
  }

  if (!hasId(normalized.environments.sandbox)) {
    return PORTAL_STEP.sandbox;
  }

  if (!normalized.webhooks.length) {
    return PORTAL_STEP.webhooks;
  }

  if (!isApproved(normalized.organization?.kyb_status)) {
    return PORTAL_STEP.kyb;
  }

  if (
    !isProductionEnabled(
      normalized.environments.production
    )
  ) {
    return PORTAL_STEP.production_status;
  }

  return PORTAL_STEP.production;
}

export function derivePortalActions(state = {}) {
  const normalized =
    normalizeIntegrationPortalState(state);

  const actions = [];

  if (!hasId(normalized.organization)) {
    actions.push(PORTAL_ACTION.create_organization);
    return actions;
  }

  if (!hasId(normalized.application)) {
    actions.push(PORTAL_ACTION.create_application);
    return actions;
  }

  if (hasId(normalized.environments.sandbox)) {
    actions.push(
      PORTAL_ACTION.issue_sandbox_credential
    );
  }

  if (hasId(normalized.application)) {
    actions.push(PORTAL_ACTION.create_webhook);
  }

  if (!isApproved(normalized.organization?.kyb_status)) {
    actions.push(PORTAL_ACTION.start_didit_kyb);
  }

  return actions;
}

export function canRunPortalAction(state, action) {
  return derivePortalActions(state).includes(action);
}

export function reduceIntegrationPortalState(
  state,
  event = {}
) {
  const current =
    normalizeIntegrationPortalState(state);

  switch (event.type) {
    case "loading":
      return {
        ...current,
        loading: true,
        error: null
      };

    case "loaded":
      return normalizeIntegrationPortalState({
        ...current,
        ...event,
        loading: false,
        loaded: true,
        error: null
      });

    case "error":
      return {
        ...current,
        loading: false,
        loaded: true,
        error: event.error || null
      };

    case "organization_created":
      return normalizeIntegrationPortalState({
        ...current,
        organization: event.organization,
        loading: false,
        loaded: true,
        error: null
      });

    case "application_created":
      return normalizeIntegrationPortalState({
        ...current,
        application: event.application,
        environments: event.environments,
        loading: false,
        loaded: true,
        error: null
      });

    case "credential_issued":
      return normalizeIntegrationPortalState({
        ...current,
        credentials: [
          ...current.credentials,
          event.credential
        ],
        one_time_secret: event.secret || null,
        loading: false,
        loaded: true,
        error: null
      });

    case "webhook_created":
      return normalizeIntegrationPortalState({
        ...current,
        webhooks: [
          ...current.webhooks,
          event.webhook
        ],
        one_time_secret:
          event.signing_secret || null,
        loading: false,
        loaded: true,
        error: null
      });

    case "kyb_started":
      return normalizeIntegrationPortalState({
        ...current,
        kyb: event.kyb || current.kyb,
        organization:
          event.organization || current.organization,
        loading: false,
        loaded: true,
        error: null
      });

    case "kyb_status_updated":
      return normalizeIntegrationPortalState({
        ...current,
        kyb: event.kyb || current.kyb,
        organization:
          event.organization || current.organization,
        loading: false,
        loaded: true,
        error: null
      });

    case "production_status_updated":
      return normalizeIntegrationPortalState({
        ...current,
        production_status:
          event.production_status ||
          current.production_status,
        environments:
          event.environments || current.environments,
        loading: false,
        loaded: true,
        error: null
      });

    case "select_environment":
      return normalizeIntegrationPortalState({
        ...current,
        selected_environment_type:
          event.environment_type
      });

    case "clear_secret":
      return {
        ...current,
        one_time_secret: null
      };

    default:
      return current;
  }
}
