// partner-portal/js/integrationPortalState.js

const EMPTY_LIST = Object.freeze([]);

export const PORTAL_STEP = {
  dashboard: "dashboard",
  organization: "organization",
  application: "application",
  questionnaire: "questionnaire",
  kyb: "kyb",
  pilot_access: "pilot_access",
  approved_corridors: "approved_corridors",
  api_keys: "api_keys",
  integration_guide: "integration_guide"
};

export const PORTAL_ACTION = {
  create_organization: "create_organization",
  create_application: "create_application",
  submit_questionnaire: "submit_questionnaire",
  issue_pilot_credential: "issue_pilot_credential",
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
    return (
      environments.find(
        environment => environment?.type === type
      ) || null
    );
  }

  return environments?.[type] || null;
}

function hasId(record) {
  return Boolean(normalizeString(record?.id));
}

function isApproved(value) {
  return value === "approved";
}

function isSubmitted(value) {
  return value === "submitted";
}

function isEnabled(environment = {}) {
  return environment?.status === "enabled" ||
    environment?.status === "pilot_enabled" ||
    environment?.status === "active";
}

function getQuestionnaireStatus(organization = {}) {
  return normalizeString(
    organization?.onboarding_profile?.status ||
      organization?.onboarding_status
  );
}

function getApprovedCorridors(organization = {}) {
  return asArray(
    organization?.requested_corridors
  ).filter(corridor => (
    corridor?.approved_for_pilot === true ||
    corridor?.status === "approved" ||
    corridor?.pilot_status === "approved"
  ));
}

function canIssuePilotCredential(normalized = {}) {
  return (
    hasId(normalized.environments?.pilot) &&
    isSubmitted(
      getQuestionnaireStatus(
        normalized.organization
      )
    ) &&
    isApproved(normalized.organization?.kyb_status) &&
    isEnabled(normalized.environments?.pilot)
  );
}

export function createEmptyIntegrationPortalState() {
  return {
    organization: null,
    application: null,

    environments: {
      pilot: null,
      production: null
    },

    credentials: [],
    webhooks: [],

    kyb: null,
    pilot_access: null,
    production_status: null,

    selected_environment_type: "pilot",

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
      pilot:
        findEnvironment(environments, "pilot") ||
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

    pilot_access:
      input.pilot_access || null,

    production_status:
      input.production_status || null,

    selected_environment_type:
      normalizeString(input.selected_environment_type) ||
      "pilot",

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

export function getPilotEnvironment(state = {}) {
  return normalizeIntegrationPortalState(state)
    .environments
    .pilot;
}

export function getApprovedPilotCorridors(state = {}) {
  const normalized =
    normalizeIntegrationPortalState(state);

  return getApprovedCorridors(
    normalized.organization
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

  if (
    !isSubmitted(
      getQuestionnaireStatus(
        normalized.organization
      )
    )
  ) {
    return PORTAL_STEP.questionnaire;
  }

  if (!isApproved(normalized.organization?.kyb_status)) {
    return PORTAL_STEP.kyb;
  }

  if (!isEnabled(normalized.environments.pilot)) {
    return PORTAL_STEP.pilot_access;
  }

  if (!getApprovedCorridors(normalized.organization).length) {
    return PORTAL_STEP.approved_corridors;
  }

  return PORTAL_STEP.api_keys;
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

  if (
    !isSubmitted(
      getQuestionnaireStatus(
        normalized.organization
      )
    )
  ) {
    actions.push(PORTAL_ACTION.submit_questionnaire);
  }

  if (!isApproved(normalized.organization?.kyb_status)) {
    actions.push(PORTAL_ACTION.start_didit_kyb);
  }

  if (canIssuePilotCredential(normalized)) {
    actions.push(
      PORTAL_ACTION.issue_pilot_credential
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
        error: null,
        one_time_secret: null
      };

    case "loaded":
      return normalizeIntegrationPortalState({
        ...current,
        ...event,
        one_time_secret: null,
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

    case "questionnaire_submitted":
      return normalizeIntegrationPortalState({
        ...current,
        organization:
          event.organization || current.organization,
        pilot_access:
          event.pilot_access || current.pilot_access,
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

    case "pilot_access_updated":
      return normalizeIntegrationPortalState({
        ...current,
        pilot_access:
          event.pilot_access ||
          current.pilot_access,
        environments:
          event.environments || current.environments,
        organization:
          event.organization || current.organization,
        loading: false,
        loaded: true,
        error: null
      });

    case "select_environment":
      return normalizeIntegrationPortalState({
        ...current,
        selected_environment_type:
          event.environment_type || "pilot"
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
