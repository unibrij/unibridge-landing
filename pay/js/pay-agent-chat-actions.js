// pay/js/pay-agent-chat-actions.js

/*
--------------------------------------------------
Pay Agent Chat Actions

Responsibility:
- Own Pay Agent API calls from the chat UI.
- Own safe storage interaction for agent_plan_id + last safe response.
- Send free-text chat messages.
- Send deterministic action payloads.
- Prepare wallet handoff and extract connect_url.

Does not:
- Render DOM.
- Append chat messages.
- Decide what button to show.
- Mask private values.
- Build normalized_intent.
- Execute payout.
--------------------------------------------------
*/

window.UnibridgePayAgentChatActions = (() => {
  const DEFAULT_LOCALE =
    "en";

  function getApi() {
    return window.UnibridgePayAgentApi || null;
  }

  function getStorage() {
    return window.UnibridgePayAgentStorage || null;
  }

  function getSelectors() {
    return window.UnibridgePayAgentChatSelectors || null;
  }

  function normalizeString(value) {
    const Selectors =
      getSelectors();

    if (Selectors?.normalizeString) {
      return Selectors.normalizeString(value);
    }

    if (value === null || value === undefined) {
      return "";
    }

    return String(value).trim();
  }

  function normalizeObject(value) {
    const Selectors =
      getSelectors();

    if (Selectors?.normalizeObject) {
      return Selectors.normalizeObject(value);
    }

    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return {};
    }

    return value;
  }

  function getFundingMethodIds() {
    const Selectors =
      getSelectors();

    return (
      Selectors?.FUNDING_METHOD_IDS || {
        wallet:
          "wallet",

        card:
          "card",

        bankTransfer:
          "bank_transfer"
      }
    );
  }

  function pickAgentPlanId(response = {}) {
    const Selectors =
      getSelectors();

    if (Selectors?.pickAgentPlanId) {
      return Selectors.pickAgentPlanId(response);
    }

    const data =
      normalizeObject(response);

    return normalizeString(
      data.agent_plan_id ||
        data.pay_agent_plan_id ||
        data.plan_id ||
        data.id ||
        data.plan?.agent_plan_id ||
        data.plan?.id
    );
  }

  function saveResponse(response = {}) {
    const storage =
      getStorage();

    if (!storage?.saveResponse) {
      return;
    }

    storage.saveResponse(
      response
    );
  }

  function saveAgentPlanId(response = {}) {
    const storage =
      getStorage();

    if (!storage?.setAgentPlanId) {
      return;
    }

    const agentPlanId =
      pickAgentPlanId(response);

    if (agentPlanId) {
      storage.setAgentPlanId(
        agentPlanId
      );
    }
  }

  function saveChatResponse(response = {}) {
    const data =
      normalizeObject(response);

    saveAgentPlanId(data);
    saveResponse(data);

    return data;
  }

  function getAgentPlanId() {
    const storage =
      getStorage();

    if (!storage?.getAgentPlanId) {
      return "";
    }

    return normalizeString(
      storage.getAgentPlanId()
    );
  }

  function getLastSafeResponse() {
    const storage =
      getStorage();

    if (!storage?.getLastResponse) {
      return {};
    }

    return normalizeObject(
      storage.getLastResponse()
    );
  }

  function hasActivePlan() {
    const storage =
      getStorage();

    if (!storage?.hasActivePlan) {
      return Boolean(
        getAgentPlanId()
      );
    }

    return storage.hasActivePlan() === true;
  }

  function clearStorage() {
    const storage =
      getStorage();

    if (storage?.clear) {
      storage.clear();
    }
  }

  function assertApi() {
    const api =
      getApi();

    if (!api) {
      throw new Error("Pay Agent API is not loaded.");
    }

    return api;
  }

  function assertAgentPlanId() {
    const agentPlanId =
      getAgentPlanId();

    if (!agentPlanId) {
      throw new Error(
        "I could not find the payment plan. Please start again."
      );
    }

    return agentPlanId;
  }

  async function sendChatMessage({
    message,
    locale = DEFAULT_LOCALE
  } = {}) {
    const api =
      assertApi();

    if (typeof api.sendChatMessage !== "function") {
      throw new Error("Pay Agent chat API is not loaded.");
    }

    const cleanMessage =
      normalizeString(message);

    if (!cleanMessage) {
      throw new Error("Message is empty.");
    }

    const response =
      await api.sendChatMessage({
        agent_plan_id:
          getAgentPlanId() || undefined,

        message:
          cleanMessage,

        locale
      });

    return saveChatResponse(
      response
    );
  }

  function buildActionMessageFromPayload(payload = {}) {
    const Selectors =
      getSelectors();

    if (Selectors?.buildActionMessageFromPayload) {
      return Selectors.buildActionMessageFromPayload(payload);
    }

    const data =
      normalizeObject(payload);

    return normalizeString(
      data.message ||
        data.value ||
        data.funding_method ||
        data.option_id ||
        data.action
    );
  }

  async function sendActionPayload(payload = {}) {
    const api =
      assertApi();

    const agentPlanId =
      assertAgentPlanId();

    const body = {
      agent_plan_id:
        agentPlanId,

      ...normalizeObject(payload)
    };

    if (typeof api.sendUpdateAction === "function") {
      return saveChatResponse(
        await api.sendUpdateAction(body)
      );
    }

    if (typeof api.updateAgentPlan === "function") {
      return saveChatResponse(
        await api.updateAgentPlan(body)
      );
    }

    if (typeof api.updatePlan === "function") {
      return saveChatResponse(
        await api.updatePlan(body)
      );
    }

    if (typeof api.sendPayAgentUpdate === "function") {
      return saveChatResponse(
        await api.sendPayAgentUpdate(body)
      );
    }

    if (typeof api.sendChatMessage === "function") {
      const message =
        buildActionMessageFromPayload(body);

      if (!message) {
        throw new Error("Pay Agent action message is empty.");
      }

      return saveChatResponse(
        await api.sendChatMessage({
          agent_plan_id:
            agentPlanId,

          message,

          locale:
            DEFAULT_LOCALE
        })
      );
    }

    throw new Error("Pay Agent update API is not loaded.");
  }

  function buildFundingMethodPayload(method) {
    const fundingMethod =
      normalizeString(method);

    return {
      action:
        "select_funding_method",

      funding_method:
        fundingMethod,

      value:
        fundingMethod,

      message:
        fundingMethod
    };
  }

  function buildOptionPayload(option = {}) {
    const Selectors =
      getSelectors();

    const item =
      normalizeObject(option);

    const optionId =
      Selectors?.normalizeOptionId
        ? Selectors.normalizeOptionId(option)
        : normalizeString(
            item.id ||
              item.value ||
              item.method ||
              item.funding_method ||
              item.type ||
              item.action ||
              item.name
          );

    const action =
      normalizeString(
        item.action ||
          "select_option"
      );

    return {
      action,

      option_id:
        optionId,

      value:
        optionId,

      message:
        optionId
    };
  }

  function buildNextActionPayload(nextAction = {}) {
    const item =
      normalizeObject(nextAction);

    const action =
      normalizeString(
        item.type ||
          item.action
      );

    return {
      action,

      message:
        action
    };
  }

  function extractConnectUrl(result = {}) {
    const data =
      normalizeObject(result);

    return normalizeString(
      data.connect_url ||
        data.handoff?.connect_url ||
        data.handoff?.url ||
        data.selected?.connect_url ||
        data.selected?.handoff?.connect_url ||
        data.selected?.handoff?.url ||
        data.response?.connect_url ||
        data.response?.handoff?.connect_url ||
        data.response?.handoff?.url ||
        data.url
    );
  }

  function pickWalletResponseForStorage(result = {}) {
    const data =
      normalizeObject(result);

    if (
      data.selected &&
      typeof data.selected === "object" &&
      !Array.isArray(data.selected)
    ) {
      return data.selected;
    }

    if (
      data.response &&
      typeof data.response === "object" &&
      !Array.isArray(data.response)
    ) {
      return data.response;
    }

    return data;
  }

  function saveWalletHandoffResult(result = {}) {
    const data =
      normalizeObject(result);

    const responseForStorage =
      pickWalletResponseForStorage(data);

    saveChatResponse(
      responseForStorage
    );

    return data;
  }

  async function prepareWalletHandoff() {
    const api =
      assertApi();

    const agentPlanId =
      assertAgentPlanId();

    const ids =
      getFundingMethodIds();

    let result = null;

    if (typeof api.selectWalletAndCreateHandoff === "function") {
      result =
        await api.selectWalletAndCreateHandoff(
          agentPlanId
        );
    } else {
      result =
        await sendActionPayload(
          buildFundingMethodPayload(
            ids.wallet
          )
        );
    }

    const normalizedResult =
      saveWalletHandoffResult(
        result
      );

    const connectUrl =
      extractConnectUrl(
        normalizedResult
      );

    return {
      result:
        normalizedResult,

      response:
        pickWalletResponseForStorage(
          normalizedResult
        ),

      connect_url:
        connectUrl
    };
  }

  return {
    DEFAULT_LOCALE,

    getApi,
    getStorage,
    getAgentPlanId,
    getLastSafeResponse,
    hasActivePlan,

    saveResponse,
    saveAgentPlanId,
    saveChatResponse,
    clearStorage,

    sendChatMessage,
    sendActionPayload,

    buildFundingMethodPayload,
    buildOptionPayload,
    buildNextActionPayload,

    prepareWalletHandoff,
    extractConnectUrl
  };
})();
