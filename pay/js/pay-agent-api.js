// pay/js/pay-agent-api.js

/*
--------------------------------------------------
Pay Agent API client v1

Frontend-only API wrapper for /pay chat UI.

Calls:
- POST /v2/pay-agent/chat
- POST /v2/pay-agent/select-funding
- POST /v2/pay-agent/handoff
- GET  /v2/pay-agent/status/:agent_plan_id
- GET  /v2/pay-agent/handoff/:agent_plan_id

Does not:
- Build normalized_intent client-side.
- Select route client-side.
- Execute payout.
- Confirm funding.
--------------------------------------------------
*/

window.UnibridgePayAgentApi = (() => {
  const API_BASE =
    "https://unibridge-v2-1066944028362.us-central1.run.app/v2";

  function normalizeString(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value).trim();
  }

  function normalizeObject(value) {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return {};
    }

    return value;
  }

  function stripUndefined(value = {}) {
    const input =
      normalizeObject(value);

    const output = {};

    Object.entries(input).forEach(([key, item]) => {
      if (item !== undefined) {
        output[key] = item;
      }
    });

    return output;
  }

  async function parseResponse(response) {
    const text =
      await response.text();

    let data = {};

    try {
      data =
        text ? JSON.parse(text) : {};
    } catch {
      data = {
        raw:
          text
      };
    }

    if (!response.ok || data?.ok === false) {
      const message =
        data?.error ||
        data?.message ||
        data?.raw ||
        "pay_agent_api_error";

      const error =
        new Error(message);

      error.status =
        response.status;

      error.data =
        data;

      throw error;
    }

    return data;
  }

  async function apiPost(path, payload = {}) {
    const response =
      await fetch(
        `${API_BASE}${path}`,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(
              stripUndefined(payload)
            )
        }
      );

    return parseResponse(response);
  }

  async function apiGet(path) {
    const response =
      await fetch(
        `${API_BASE}${path}`,
        {
          method:
            "GET",

          headers: {
            "Accept":
              "application/json"
          }
        }
      );

    return parseResponse(response);
  }

  function extractAgentPlanId(result = {}) {
    const data =
      normalizeObject(result);

    return normalizeString(
      data.agent_plan_id ||
        data.pay_agent_plan_id ||
        data.plan_id ||
        data.id
    );
  }

  function extractConnectUrl(result = {}) {
    const data =
      normalizeObject(result);

    return normalizeString(
      data.connect_url ||
        data.hosted_url ||
        data.funding_handoff?.connect_url ||
        data.funding_handoff?.hosted_url ||
        data.handoff?.connect_url ||
        data.handoff?.hosted_url
    );
  }

  function toAbsoluteConnectUrl(url) {
    const value =
      normalizeString(url);

    if (!value) {
      return "";
    }

    if (
      value.startsWith("http://") ||
      value.startsWith("https://")
    ) {
      return value;
    }

    if (value.startsWith("/connect")) {
      return `${window.location.origin}${value}`;
    }

    if (value.startsWith("connect")) {
      return `${window.location.origin}/${value}`;
    }

    return value;
  }

  async function sendChatMessage({
    agent_plan_id = null,
    message,
    locale = "en"
  } = {}) {
    return apiPost(
      "/pay-agent/chat",
      {
        agent_plan_id:
          normalizeString(agent_plan_id) || undefined,

        message:
          normalizeString(message),

        locale:
          normalizeString(locale) || "en"
      }
    );
  }

  async function selectFunding({
    agent_plan_id,
    funding_method = "wallet"
  } = {}) {
    return apiPost(
      "/pay-agent/select-funding",
      {
        agent_plan_id:
          normalizeString(agent_plan_id),

        funding_method:
          normalizeString(funding_method)
      }
    );
  }

  async function createHandoff({
    agent_plan_id
  } = {}) {
    return apiPost(
      "/pay-agent/handoff",
      {
        agent_plan_id:
          normalizeString(agent_plan_id)
      }
    );
  }

  async function getStatus(agent_plan_id) {
    const id =
      encodeURIComponent(
        normalizeString(agent_plan_id)
      );

    return apiGet(
      `/pay-agent/status/${id}`
    );
  }

  async function getHandoff(agent_plan_id) {
    const id =
      encodeURIComponent(
        normalizeString(agent_plan_id)
      );

    return apiGet(
      `/pay-agent/handoff/${id}`
    );
  }

  async function selectWalletAndCreateHandoff(agent_plan_id) {
    const selected =
      await selectFunding({
        agent_plan_id,
        funding_method:
          "wallet"
      });

    const handoff =
      await createHandoff({
        agent_plan_id
      });

    return {
      selected,
      handoff,

      connect_url:
        toAbsoluteConnectUrl(
          extractConnectUrl(handoff)
        )
    };
  }

  return {
    API_BASE,

    sendChatMessage,
    selectFunding,
    createHandoff,
    getStatus,
    getHandoff,
    selectWalletAndCreateHandoff,

    extractAgentPlanId,
    extractConnectUrl,
    toAbsoluteConnectUrl
  };
})();
