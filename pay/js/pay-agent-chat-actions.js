// pay/js/pay-agent-chat-actions.js

/*
--------------------------------------------------
Pay Agent Chat Actions
--------------------------------------------------
*/

window.UnibridgePayAgentChatActions = (() => {
  const DEFAULT_LOCALE = "en";

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
    const Selectors = getSelectors();

    if (Selectors?.normalizeString) {
      return Selectors.normalizeString(value);
    }

    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "string") {
      return value.trim();
    }

    if (
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return String(value).trim();
    }

    if (typeof value === "object") {
      return normalizeString(
        value.reply ||
          value.message ||
          value.text ||
          value.label ||
          value.content ||
          value.title ||
          value.value ||
          value.id ||
          value.action ||
          ""
      );
    }

    return String(value).trim();
  }

  function normalizeObject(value) {
    const Selectors = getSelectors();

    if (Selectors?.normalizeObject) {
      return Selectors.normalizeObject(value);
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return value;
  }

  function pickFirstObject(...values) {
    for (const value of values) {
      const item = normalizeObject(value);

      if (Object.keys(item).length) {
        return item;
      }
    }

    return {};
  }

  function getFundingMethodIds() {
    const Selectors = getSelectors();

    return (
      Selectors?.FUNDING_METHOD_IDS || {
        wallet: "wallet",
        card: "card",
        bankTransfer: "bank_transfer"
      }
    );
  }

  function pickAgentPlanId(response = {}) {
    const Selectors = getSelectors();

    if (Selectors?.pickAgentPlanId) {
      return Selectors.pickAgentPlanId(response);
    }

    const data = normalizeObject(response);

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
    const storage = getStorage();

    if (!storage?.saveResponse) {
      return;
    }

    storage.saveResponse(response);
  }

  function saveAgentPlanId(response = {}) {
    const storage = getStorage();

    if (!storage?.setAgentPlanId) {
      return;
    }

    const agentPlanId = pickAgentPlanId(response);

    if (agentPlanId) {
      storage.setAgentPlanId(agentPlanId);
    }
  }

  function saveChatResponse(response = {}) {
    const data = normalizeObject(response);

    saveAgentPlanId(data);
    saveResponse(data);

    return data;
  }

  function getAgentPlanId() {
    const storage = getStorage();

    if (!storage?.getAgentPlanId) {
      return "";
    }

    return normalizeString(storage.getAgentPlanId());
  }

  function getLastSafeResponse() {
    const storage = getStorage();

    if (!storage?.getLastResponse) {
      return {};
    }

    return normalizeObject(storage.getLastResponse());
  }

  function hasActivePlan() {
    const storage = getStorage();

    if (!storage?.hasActivePlan) {
      return Boolean(getAgentPlanId());
    }

    return storage.hasActivePlan() === true;
  }

  function clearStorage() {
    const storage = getStorage();

    if (storage?.clear) {
      storage.clear();
    }
  }

  function assertApi() {
    const api = getApi();

    if (!api) {
      throw new Error("Pay Agent API is not loaded.");
    }

    return api;
  }

  function assertAgentPlanId() {
    const agentPlanId = getAgentPlanId();

    if (!agentPlanId) {
      throw new Error(
        "I could not find the payment plan. Please start again."
      );
    }

    return agentPlanId;
  }

  async function sendChatMessage({ message, locale = DEFAULT_LOCALE } = {}) {
    const api = assertApi();

    if (typeof api.sendChatMessage !== "function") {
      throw new Error("Pay Agent chat API is not loaded.");
    }

    const cleanMessage = normalizeString(message);

    if (!cleanMessage) {
      throw new Error("Message is empty.");
    }

    const response = await api.sendChatMessage({
      agent_plan_id: getAgentPlanId() || undefined,
      message: cleanMessage,
      locale
    });

    return saveChatResponse(response);
  }

  function buildActionMessageFromPayload(payload = {}) {
    const Selectors = getSelectors();

    if (Selectors?.buildActionMessageFromPayload) {
      return Selectors.buildActionMessageFromPayload(payload);
    }

    const data = normalizeObject(payload);

    return normalizeString(
      data.message ||
        data.value ||
        data.funding_method ||
        data.option_id ||
        data.action
    );
  }

  async function sendActionPayload(payload = {}) {
    const api = assertApi();
    const agentPlanId = assertAgentPlanId();

    const body = {
      agent_plan_id: agentPlanId,
      ...normalizeObject(payload)
    };

    if (typeof api.sendUpdateAction === "function") {
      return saveChatResponse(await api.sendUpdateAction(body));
    }

    if (typeof api.updateAgentPlan === "function") {
      return saveChatResponse(await api.updateAgentPlan(body));
    }

    if (typeof api.updatePlan === "function") {
      return saveChatResponse(await api.updatePlan(body));
    }

    if (typeof api.sendPayAgentUpdate === "function") {
      return saveChatResponse(await api.sendPayAgentUpdate(body));
    }

    if (typeof api.sendChatMessage === "function") {
      const message = buildActionMessageFromPayload(body);

      if (!message) {
        throw new Error("Pay Agent action message is empty.");
      }

      return saveChatResponse(
        await api.sendChatMessage({
          agent_plan_id: agentPlanId,
          message,
          locale: DEFAULT_LOCALE
        })
      );
    }

    throw new Error("Pay Agent update API is not loaded.");
  }

  function buildFundingMethodPayload(method) {
    const fundingMethod = normalizeString(method);

    return {
      action: "select_funding_method",
      funding_method: fundingMethod,
      value: fundingMethod,
      message: fundingMethod
    };
  }

  function buildOptionPayload(option = {}) {
    const Selectors = getSelectors();
    const item = normalizeObject(option);

    const optionId = Selectors?.normalizeOptionId
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

    const action = normalizeString(item.action || "select_option");

    return {
      action,
      option_id: optionId,
      value: optionId,
      message: optionId
    };
  }

  function buildNextActionPayload(nextAction = {}) {
    const item = normalizeObject(nextAction);
    const action = normalizeString(item.type || item.action);

    return {
      action,
      message: action
    };
  }

  function extractConnectUrl(result = {}) {
    const data = normalizeObject(result);

    return normalizeString(
      data.connect_url ||
        data.data?.connect_url ||
        data.handoff?.connect_url ||
        data.handoff?.url ||
        data.data?.handoff?.connect_url ||
        data.data?.handoff?.url ||
        data.selected?.connect_url ||
        data.selected?.handoff?.connect_url ||
        data.selected?.handoff?.url ||
        data.response?.connect_url ||
        data.response?.data?.connect_url ||
        data.response?.handoff?.connect_url ||
        data.response?.handoff?.url ||
        data.response?.data?.handoff?.connect_url ||
        data.response?.data?.handoff?.url ||
        data.url
    );
  }

  function extractHandoffUrl(result = {}) {
    const data = normalizeObject(result);

    return normalizeString(
      data.checkout_url ||
        data.handoff_url ||
        data.redirect_url ||
        data.url ||
        data.connect_url ||
        data.data?.checkout_url ||
        data.data?.handoff_url ||
        data.data?.redirect_url ||
        data.data?.url ||
        data.data?.connect_url ||
        data.handoff?.checkout_url ||
        data.handoff?.handoff_url ||
        data.handoff?.redirect_url ||
        data.handoff?.url ||
        data.handoff?.connect_url ||
        data.data?.handoff?.checkout_url ||
        data.data?.handoff?.handoff_url ||
        data.data?.handoff?.redirect_url ||
        data.data?.handoff?.url ||
        data.data?.handoff?.connect_url ||
        data.selected?.checkout_url ||
        data.selected?.handoff_url ||
        data.selected?.redirect_url ||
        data.selected?.url ||
        data.selected?.connect_url ||
        data.selected?.handoff?.checkout_url ||
        data.selected?.handoff?.handoff_url ||
        data.selected?.handoff?.redirect_url ||
        data.selected?.handoff?.url ||
        data.selected?.handoff?.connect_url ||
        data.response?.checkout_url ||
        data.response?.handoff_url ||
        data.response?.redirect_url ||
        data.response?.url ||
        data.response?.connect_url ||
        data.response?.data?.checkout_url ||
        data.response?.data?.handoff_url ||
        data.response?.data?.redirect_url ||
        data.response?.data?.url ||
        data.response?.data?.connect_url ||
        data.response?.handoff?.checkout_url ||
        data.response?.handoff?.handoff_url ||
        data.response?.handoff?.redirect_url ||
        data.response?.handoff?.url ||
        data.response?.handoff?.connect_url ||
        data.response?.data?.handoff?.checkout_url ||
        data.response?.data?.handoff?.handoff_url ||
        data.response?.data?.handoff?.redirect_url ||
        data.response?.data?.handoff?.url ||
        data.response?.data?.handoff?.connect_url
    );
  }

  function extractClientSecret(result = {}) {
    const data = normalizeObject(result);

    return normalizeString(
      data.client_secret ||
        data.data?.client_secret ||
        data.handoff?.client_secret ||
        data.data?.handoff?.client_secret ||
        data.selected?.client_secret ||
        data.selected?.handoff?.client_secret ||
        data.response?.client_secret ||
        data.response?.data?.client_secret ||
        data.response?.handoff?.client_secret ||
        data.response?.data?.handoff?.client_secret ||
        data.next_action?.meta?.client_secret ||
        data.data?.next_action?.meta?.client_secret ||
        data.handoff?.next_action?.meta?.client_secret ||
        data.data?.handoff?.next_action?.meta?.client_secret ||
        data.selected?.next_action?.meta?.client_secret ||
        data.selected?.handoff?.next_action?.meta?.client_secret ||
        data.response?.next_action?.meta?.client_secret ||
        data.response?.data?.next_action?.meta?.client_secret ||
        data.response?.handoff?.next_action?.meta?.client_secret ||
        data.response?.data?.handoff?.next_action?.meta?.client_secret
    );
  }

  function extractNextAction(result = {}) {
    const data = normalizeObject(result);

    return pickFirstObject(
      data.next_action,
      data.data?.next_action,
      data.handoff?.next_action,
      data.data?.handoff?.next_action,
      data.selected?.next_action,
      data.selected?.handoff?.next_action,
      data.response?.next_action,
      data.response?.data?.next_action,
      data.response?.handoff?.next_action,
      data.response?.data?.handoff?.next_action
    );
  }

  function extractFundingSessionId(result = {}) {
    const data = normalizeObject(result);

    return normalizeString(
      data.funding_session_id ||
        data.data?.funding_session_id ||
        data.handoff?.funding_session_id ||
        data.data?.handoff?.funding_session_id ||
        data.selected?.funding_session_id ||
        data.selected?.handoff?.funding_session_id ||
        data.response?.funding_session_id ||
        data.response?.data?.funding_session_id ||
        data.response?.handoff?.funding_session_id ||
        data.response?.data?.handoff?.funding_session_id
    );
  }

  function extractSettlementId(result = {}) {
    const data = normalizeObject(result);

    return normalizeString(
      data.settlement_id ||
        data.data?.settlement_id ||
        data.handoff?.settlement_id ||
        data.data?.handoff?.settlement_id ||
        data.selected?.settlement_id ||
        data.selected?.handoff?.settlement_id ||
        data.response?.settlement_id ||
        data.response?.data?.settlement_id ||
        data.response?.handoff?.settlement_id ||
        data.response?.data?.handoff?.settlement_id
    );
  }

  function pickWalletResponseForStorage(result = {}) {
    const data = normalizeObject(result);

    if (data.selected && typeof data.selected === "object" && !Array.isArray(data.selected)) {
      return data.selected;
    }

    if (data.response && typeof data.response === "object" && !Array.isArray(data.response)) {
      return data.response;
    }

    if (data.data && typeof data.data === "object" && !Array.isArray(data.data)) {
      return data.data;
    }

    return data;
  }

  function pickHandoffResponseForStorage(result = {}) {
    const data = normalizeObject(result);

    if (data.selected && typeof data.selected === "object" && !Array.isArray(data.selected)) {
      return data.selected;
    }

    if (data.response && typeof data.response === "object" && !Array.isArray(data.response)) {
      return data.response;
    }

    if (data.data && typeof data.data === "object" && !Array.isArray(data.data)) {
      return data.data;
    }

    return data;
  }

  function saveWalletHandoffResult(result = {}) {
    const data = normalizeObject(result);
    const responseForStorage = pickWalletResponseForStorage(data);

    saveChatResponse(responseForStorage);

    return data;
  }

  function saveHandoffResult(result = {}) {
    const data = normalizeObject(result);
    const responseForStorage = pickHandoffResponseForStorage(data);

    saveChatResponse(responseForStorage);

    return data;
  }

  async function prepareWalletHandoff() {
    const api = assertApi();
    const agentPlanId = assertAgentPlanId();
    const ids = getFundingMethodIds();

    let result = null;

    if (typeof api.selectWalletAndCreateHandoff === "function") {
      result = await api.selectWalletAndCreateHandoff(agentPlanId);
    } else {
      result = await sendActionPayload(buildFundingMethodPayload(ids.wallet));
    }

    const normalizedResult = saveWalletHandoffResult(result);
    const connectUrl = extractConnectUrl(normalizedResult);

    return {
      result: normalizedResult,
      response: pickWalletResponseForStorage(normalizedResult),
      connect_url: connectUrl
    };
  }

  async function prepareHandoff() {
    const api = assertApi();
    const agentPlanId = assertAgentPlanId();

    if (typeof api.createHandoff !== "function") {
      throw new Error("Pay Agent handoff API is not loaded.");
    }

    const result = await api.createHandoff({
      agent_plan_id: agentPlanId
    });

    const normalizedResult = saveHandoffResult(result);

    const redirectUrl = extractHandoffUrl(normalizedResult);
    const clientSecret = extractClientSecret(normalizedResult);
    const nextAction = extractNextAction(normalizedResult);
    const fundingSessionId = extractFundingSessionId(normalizedResult);
    const settlementId = extractSettlementId(normalizedResult);

    return {
      result: normalizedResult,
      response: pickHandoffResponseForStorage(normalizedResult),

      client_secret: clientSecret,
      next_action: nextAction,

      funding_session_id: fundingSessionId,
      settlement_id: settlementId,

      checkout_url: redirectUrl,
      handoff_url: redirectUrl,
      redirect_url: redirectUrl,
      url: redirectUrl
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
    prepareHandoff,

    extractConnectUrl,
    extractHandoffUrl,
    extractClientSecret,
    extractNextAction,
    extractFundingSessionId,
    extractSettlementId
  };
})();
