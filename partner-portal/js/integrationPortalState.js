// partner-portal/js/integrationPortalState.js

const EMPTY_LIST = Object.freeze([]);

export const PORTAL_STEP = {
  organization: "organization",
  application: "application",
  sandbox: "sandbox",
  webhooks: "webhooks",
  kyb: "kyb",
  go_live: "go_live",
  production: "production"
};

export const PORTAL_ACTION = {
  create_organization: "create_organization",
  create_application: "create_application",
  issue_sandbox_credential: "issue_sandbox_credential",
  create_webhook: "create_webhook",
  submit_kyb: "submit_kyb",
  request_go_live: "request_go_live",
  issue_production_credential: "issue_production_credential"
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
    !isApproved(normalized.organization?.go_live_status) ||
    !isProductionEnabled(
      normalized.environments.production
    )
  ) {
    return PORTAL_STEP.go_live;
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
    actions.push(PORTAL_ACTION.submit_kyb);
  }

  if (
    isApproved(normalized.organization?.kyb_status) &&
    !isApproved(normalized.organization?.go_live_status)
  ) {
    actions.push(PORTAL_ACTION.request_go_live);
  }

  if (
    isApproved(normalized.organization?.kyb_status) &&
    isApproved(normalized.organization?.go_live_status) &&
    isProductionEnabled(
      normalized.environments.production
    )
  ) {
    actions.push(
      PORTAL_ACTION.issue_production_credential
    );
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

    case "kyb_updated":
      return normalizeIntegrationPortalState({
        ...current,
        organization: event.organization,
        loading: false,
        loaded: true,
        error: null
      });

    case "go_live_updated":
      return normalizeIntegrationPortalState({
        ...current,
        organization: event.organization,
        environments: {
          ...current.environments,
          production: event.environment
        },
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
