// partner-portal/js/integrationsApi.js

const DEFAULT_HEADERS = {
  "Content-Type": "application/json"
};

function normalizeBaseUrl(baseUrl = "") {
  return String(baseUrl || "").replace(/\/+$/, "");
}

function createRequestId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `req_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2)}`;
}

function buildQuery(params = {}) {
  const searchParams =
    new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    const normalized =
      String(value || "").trim();

    if (normalized) {
      searchParams.set(key, normalized);
    }
  });

  const query =
    searchParams.toString();

  return query ? `?${query}` : "";
}

async function parseJson(response) {
  return response.json().catch(() => ({}));
}

function createRequestError({
  response,
  payload
}) {
  const error =
    payload?.error || {};

  const exception =
    new Error(
      error.message ||
        "Integration request failed."
    );

  exception.code = error.code || null;
  exception.status = response.status;
  exception.details = error.details || null;

  return exception;
}

async function request({
  baseUrl = "/v2/integrations",
  path,
  method = "GET",
  body,
  headers = {}
}) {
  const response =
    await fetch(
      `${normalizeBaseUrl(baseUrl)}${path}`,
      {
        method,
        headers: {
          ...DEFAULT_HEADERS,
          "X-Request-Id": createRequestId(),
          ...headers
        },
        body:
          body === undefined
            ? undefined
            : JSON.stringify(body)
      }
    );

  const payload =
    await parseJson(response);

  if (!response.ok) {
    throw createRequestError({
      response,
      payload
    });
  }

  return payload;
}

export function createIntegrationsApi({
  baseUrl = "/v2/integrations",
  headers = {}
} = {}) {
  const options = {
    baseUrl,
    headers
  };

  return {
    startPortalSession(input) {
      return request({
        ...options,
        method: "POST",
        path: "/portal-sessions/start",
        body: input
      });
    },

    verifyPortalSession(input) {
      return request({
        ...options,
        method: "POST",
        path: "/portal-sessions/verify",
        body: input
      });
    },

    listOrganizations(organizationId = "") {
      return request({
        ...options,
        path:
          `/organizations${buildQuery({
            organization_id: organizationId
          })}`
      });
    },

    getOrganization(organizationId) {
      return request({
        ...options,
        path:
          `/organizations/${organizationId}`
      });
    },

    listApplications(organizationId) {
      return request({
        ...options,
        path:
          `/organizations/${organizationId}/applications`
      });
    },

    listEnvironments(applicationId) {
      return request({
        ...options,
        path:
          `/applications/${applicationId}/environments`
      });
    },

    listCredentials(applicationId) {
      return request({
        ...options,
        path:
          `/applications/${applicationId}/credentials`
      });
    },

    listWebhooks(applicationId) {
      return request({
        ...options,
        path:
          `/applications/${applicationId}/webhooks`
      });
    },

    createOrganization(input) {
      return request({
        ...options,
        method: "POST",
        path: "/organizations",
        body: input
      });
    },

    createApplication(input) {
      return request({
        ...options,
        method: "POST",
        path: "/applications",
        body: input
      });
    },

    issueCredential(input) {
      return request({
        ...options,
        method: "POST",
        path: "/credentials",
        body: input
      });
    },

    rotateCredential(
      credentialId,
      input = {}
    ) {
      return request({
        ...options,
        method: "POST",
        path:
          `/credentials/${credentialId}/rotate`,
        body: input
      });
    },

    revokeCredential(
      credentialId,
      input = {}
    ) {
      return request({
        ...options,
        method: "POST",
        path:
          `/credentials/${credentialId}/revoke`,
        body: input
      });
    },

    createWebhook(input) {
      return request({
        ...options,
        method: "POST",
        path: "/webhooks",
        body: input
      });
    },

    updateWebhook(
      webhookId,
      input = {}
    ) {
      return request({
        ...options,
        method: "PATCH",
        path:
          `/webhooks/${webhookId}`,
        body: input
      });
    },

    disableWebhook(
      webhookId,
      input = {}
    ) {
      return request({
        ...options,
        method: "POST",
        path:
          `/webhooks/${webhookId}/disable`,
        body: input
      });
    },

    deleteWebhook(webhookId) {
      return request({
        ...options,
        method: "DELETE",
        path:
          `/webhooks/${webhookId}`
      });
    },

    startDiditKyb(input) {
      return request({
        ...options,
        method: "POST",
        path: "/kyb/didit/start",
        body: input
      });
    },

    getKybStatus(organizationId) {
      return request({
        ...options,
        path:
          `/organizations/${organizationId}/kyb-status`
      });
    },

    getProductionStatus(organizationId) {
      return request({
        ...options,
        path:
          `/organizations/${organizationId}/production-status`
      });
    }
  };
}

export default createIntegrationsApi;
