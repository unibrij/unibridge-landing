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
        credentials: "include",
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
    listOrganizations() {
      return request({
        ...options,
        path: "/organizations"
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

    submitKyb(input) {
      return request({
        ...options,
        method: "POST",
        path: "/kyb/submit",
        body: input
      });
    },

    requestGoLive(input) {
      return request({
        ...options,
        method: "POST",
        path: "/go-live/request",
        body: input
      });
    }
  };
}

export default createIntegrationsApi;
