// pay/js/pay-agent-chat.js

/*
--------------------------------------------------
Pay Agent Chat UI v1

Frontend controller for /pay/agent/.

Responsibilities:
- Render Pay Agent chat UI.
- Send user messages to backend /v2/pay-agent/chat.
- Store only agent_plan_id + safe response snapshot.
- Show funding buttons when backend says funding is ready.
- Select wallet funding.
- Create handoff.
- Open connect_url.
- Mask standalone recipient-like user inputs in the visible chat.

Does not:
- Build normalized_intent.
- Select route client-side.
- Validate beneficiary fields client-side.
- Execute payout.
- Confirm funding.
- Store beneficiary / PIX key in localStorage.
--------------------------------------------------
*/

window.UnibridgePayAgentChat = (() => {
  const DEFAULT_LOCALE =
    "en";

  const MASKED_VALUE =
    "••••••••••••••";

  const SELECTORS = {
    root:
      "[data-pay-agent-chat]",

    messages:
      "[data-pay-agent-messages]",

    form:
      "[data-pay-agent-form]",

    input:
      "[data-pay-agent-input]",

    send:
      "[data-pay-agent-send]",

    actions:
      "[data-pay-agent-actions]",

    status:
      "[data-pay-agent-status]",

    reset:
      "[data-pay-agent-reset]"
  };

  let state = {
    root:
      null,

    messages:
      null,

    form:
      null,

    input:
      null,

    send:
      null,

    actions:
      null,

    status:
      null,

    reset:
      null,

    busy:
      false
  };

  function normalizeString(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value).trim();
  }

  function normalizeLower(value) {
    return normalizeString(value).toLowerCase();
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

  function normalizeArray(value) {
    return Array.isArray(value)
      ? value
      : [];
  }

  function getApi() {
    return window.UnibridgePayAgentApi || null;
  }

  function getStorage() {
    return window.UnibridgePayAgentStorage || null;
  }

  function createElement(tag, className, text = "") {
    const element =
      document.createElement(tag);

    if (className) {
      element.className =
        className;
    }

    if (text) {
      element.textContent =
        text;
    }

    return element;
  }

  function clearElement(element) {
    if (!element) {
      return;
    }

    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  function setBusy(value) {
    state.busy =
      Boolean(value);

    if (state.input) {
      state.input.disabled =
        state.busy;
    }

    if (state.send) {
      state.send.disabled =
        state.busy;
    }

    if (state.root) {
      state.root.classList.toggle(
        "is-busy",
        state.busy
      );
    }
  }

  function setStatus(text = "ready") {
    if (!state.status) {
      return;
    }

    state.status.textContent =
      normalizeString(text) || "ready";
  }

  function scrollMessagesToBottom() {
    if (!state.messages) {
      return;
    }

    state.messages.scrollTop =
      state.messages.scrollHeight;
  }

  function isStandaloneEmail(value) {
    const text =
      normalizeString(value);

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
  }

  function isStandaloneCpfOrPhone(value) {
    const text =
      normalizeString(value);

    if (!text) {
      return false;
    }

    const digits =
      text.replace(/\D/g, "");

    if (digits.length < 8) {
      return false;
    }

    if (digits.length > 15) {
      return false;
    }

    return /^[+\d][\d\s().-]+$/.test(text);
  }

  function isStandalonePixRandomKey(value) {
    const text =
      normalizeString(value);

    if (!text) {
      return false;
    }

    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)
    ) {
      return true;
    }

    if (
      !/\s/.test(text) &&
      /^[a-z0-9._-]{18,}$/i.test(text)
    ) {
      return true;
    }

    return false;
  }

  function shouldMaskUserMessage(value) {
    const text =
      normalizeString(value);

    if (!text) {
      return false;
    }

    return (
      isStandaloneEmail(text) ||
      isStandaloneCpfOrPhone(text) ||
      isStandalonePixRandomKey(text)
    );
  }

  function getVisibleUserMessage(value) {
    const text =
      normalizeString(value);

    if (!text) {
      return "";
    }

    return shouldMaskUserMessage(text)
      ? MASKED_VALUE
      : text;
  }

  function appendMessage(role, text, options = {}) {
    if (!state.messages) {
      return null;
    }

    const messageText =
      normalizeString(text);

    if (!messageText) {
      return null;
    }

    const safeRole =
      normalizeString(role) || "assistant";

    const message =
      createElement(
        "div",
        `pay-agent-message pay-agent-message-${safeRole}`,
        messageText
      );

    if (options.compact) {
      message.classList.add(
        "pay-agent-message-compact"
      );
    }

    if (options.masked) {
      message.classList.add(
        "pay-agent-message-masked"
      );
    }

    state.messages.appendChild(
      message
    );

    scrollMessagesToBottom();

    return message;
  }

  function pickReplyText(response = {}) {
    const data =
      normalizeObject(response);

    return normalizeString(
      data.reply ||
        data.current_prompt ||
        data.message ||
        "I’m ready."
    );
  }

  function pickAgentPlanId(response = {}) {
    const data =
      normalizeObject(response);

    return normalizeString(
      data.agent_plan_id ||
        data.pay_agent_plan_id ||
        data.plan_id ||
        data.id ||
        data.plan?.agent_plan_id
    );
  }

  function pickStatus(response = {}) {
    const data =
      normalizeObject(response);

    return normalizeString(
      data.status ||
        data.plan?.status
    );
  }

  function normalizeFundingOption(item) {
    if (typeof item === "string") {
      return normalizeLower(item);
    }

    const option =
      normalizeObject(item);

    return normalizeLower(
      option.method ||
        option.type ||
        option.id ||
        option.name ||
        option.value
    );
  }

  function pickFundingOptions(response = {}) {
    const data =
      normalizeObject(response);

    const direct =
      normalizeArray(data.funding_options);

    if (direct.length) {
      return direct;
    }

    return normalizeArray(
      data.plan?.funding_options
    );
  }

  function hasWalletFunding(response = {}) {
    const options =
      pickFundingOptions(response)
        .map(normalizeFundingOption)
        .filter(Boolean);

    if (options.includes("wallet")) {
      return true;
    }

    if (options.includes("wallet_connect")) {
      return true;
    }

    const data =
      normalizeObject(response);

    return Boolean(
      data.wallet_available ||
        data.requires_wallet_connect ||
        data.funding_handoff?.type === "wallet_connect" ||
        data.handoff?.type === "wallet_connect" ||
        data.plan?.selected_funding_method === "wallet"
    );
  }

  function shouldShowFundingActions(response = {}) {
    const status =
      pickStatus(response);

    if (
      status === "funding_choice_required" ||
      status === "funding_required" ||
      status === "wallet_connect_ready"
    ) {
      return true;
    }

    const data =
      normalizeObject(response);

    const nextAction =
      normalizeLower(
        data.next_action?.type ||
          data.next_action ||
          ""
      );

    return (
      nextAction === "funding_choice" ||
      nextAction === "select_funding" ||
      nextAction === "wallet_connect"
    );
  }

  function buildRouteSummary(response = {}) {
    const data =
      normalizeObject(response);

    const route =
      normalizeObject(
        data.route ||
          data.plan?.route
      );

    const parts = [];

    if (route.label) {
      parts.push(
        normalizeString(route.label)
      );
    } else {
      if (route.country) {
        parts.push(
          normalizeString(route.country)
        );
      }

      if (route.payout_rail || route.rail) {
        parts.push(
          normalizeString(
            route.payout_rail ||
              route.rail
          )
        );
      }
    }

    if (route.asset) {
      parts.push(
        normalizeString(route.asset)
      );
    }

    if (route.network) {
      parts.push(
        normalizeString(route.network)
      );
    }

    return parts
      .filter(Boolean)
      .join(" · ");
  }

  function renderSafeSummary(response = {}) {
    const routeSummary =
      buildRouteSummary(response);

    if (routeSummary) {
      appendMessage(
        "system",
        routeSummary,
        {
          compact:
            true
        }
      );
    }
  }

  function clearActions() {
    clearElement(
      state.actions
    );
  }

  function createActionButton(label, onClick) {
    const button =
      createElement(
        "button",
        "pay-agent-action-button",
        label
      );

    button.type =
      "button";

    button.addEventListener(
      "click",
      onClick
    );

    return button;
  }

  function renderFundingActions(response = {}) {
    clearActions();

    if (!state.actions) {
      return;
    }

    if (!shouldShowFundingActions(response)) {
      return;
    }

    if (!hasWalletFunding(response)) {
      appendMessage(
        "assistant",
        "No supported funding method is available for this route yet."
      );
      return;
    }

    const walletButton =
      createActionButton(
        "Continue with wallet",
        handleWalletFunding
      );

    state.actions.appendChild(
      walletButton
    );
  }

  function saveResponse(response = {}) {
    const storage =
      getStorage();

    if (!storage) {
      return;
    }

    storage.saveResponse(
      response
    );
  }

  function saveAgentPlanId(response = {}) {
    const storage =
      getStorage();

    if (!storage) {
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

  function getAgentPlanId() {
    const storage =
      getStorage();

    if (!storage) {
      return "";
    }

    return normalizeString(
      storage.getAgentPlanId()
    );
  }

  function getLastSafeResponse() {
    const storage =
      getStorage();

    if (!storage) {
      return {};
    }

    return normalizeObject(
      storage.getLastResponse()
    );
  }

  function handleResponse(response = {}) {
    saveAgentPlanId(response);
    saveResponse(response);

    const reply =
      pickReplyText(response);

    renderSafeSummary(response);

    appendMessage(
      "assistant",
      reply
    );

    const status =
      pickStatus(response);

    setStatus(
      status || "ready"
    );

    renderFundingActions(response);
  }

  async function handleSubmit(event) {
    if (event) {
      event.preventDefault();
    }

    if (state.busy) {
      return;
    }

    const api =
      getApi();

    if (!api) {
      appendMessage(
        "assistant",
        "Pay Agent API is not loaded."
      );
      return;
    }

    const message =
      normalizeString(
        state.input?.value
      );

    if (!message) {
      return;
    }

    clearActions();

    const visibleMessage =
      getVisibleUserMessage(message);

    appendMessage(
      "user",
      visibleMessage,
      {
        masked:
          visibleMessage === MASKED_VALUE
      }
    );

    if (state.input) {
      state.input.value =
        "";
    }

    setBusy(true);
    setStatus("thinking");

    try {
      const response =
        await api.sendChatMessage({
          agent_plan_id:
            getAgentPlanId() || undefined,

          message,

          locale:
            DEFAULT_LOCALE
        });

      handleResponse(response);
    } catch (error) {
      appendMessage(
        "assistant",
        error?.message ||
          "Something went wrong. Please try again."
      );

      setStatus("error");
    } finally {
      setBusy(false);

      if (state.input) {
        state.input.focus();
      }
    }
  }

  async function handleWalletFunding() {
    if (state.busy) {
      return;
    }

    const api =
      getApi();

    if (!api) {
      appendMessage(
        "assistant",
        "Pay Agent API is not loaded."
      );
      return;
    }

    const agentPlanId =
      getAgentPlanId();

    if (!agentPlanId) {
      appendMessage(
        "assistant",
        "I could not find the payment plan. Please start again."
      );
      return;
    }

    clearActions();
    setBusy(true);
    setStatus("preparing wallet handoff");

    appendMessage(
      "assistant",
      "Preparing your wallet checkout..."
    );

    try {
      const result =
        await api.selectWalletAndCreateHandoff(
          agentPlanId
        );

      if (result.selected) {
        saveResponse(
          result.selected
        );
      }

      if (result.handoff) {
        saveResponse(
          result.handoff
        );
      }

      const connectUrl =
        normalizeString(
          result.connect_url
        );

      if (!connectUrl) {
        appendMessage(
          "assistant",
          "Wallet handoff is ready, but no connect URL was returned."
        );

        setStatus("handoff_ready");
        setBusy(false);

        renderFundingActions(
          result.selected ||
            getLastSafeResponse()
        );

        return;
      }

      setStatus("opening wallet checkout");

      window.location.href =
        connectUrl;
    } catch (error) {
      appendMessage(
        "assistant",
        error?.message ||
          "Could not prepare wallet checkout."
      );

      setStatus("error");
      setBusy(false);

      renderFundingActions(
        getLastSafeResponse()
      );
    }
  }

  function handleReset() {
    const storage =
      getStorage();

    if (storage) {
      storage.clear();
    }

    clearElement(
      state.messages
    );

    clearActions();

    setStatus("ready");

    appendMessage(
      "assistant",
      "Tell me where you want to send the payment. For example: “I want to pay 10 USDT to Brazil by PIX.”"
    );

    if (state.input) {
      state.input.value =
        "";
      state.input.focus();
    }
  }

  function createDefaultRoot() {
    const section =
      createElement(
        "section",
        "pay-agent-chat"
      );

    section.setAttribute(
      "data-pay-agent-chat",
      ""
    );

    section.innerHTML = `
      <div class="pay-agent-chat-card">
        <div class="pay-agent-chat-header">
          <div class="pay-agent-chat-title-row">
            <div class="pay-agent-chat-icon" aria-hidden="true">✦</div>
            <div>
              <p class="pay-agent-chat-kicker">Pay with UniBridge</p>
              <h2>Route preparation assistant</h2>
            </div>
          </div>

          <button type="button" class="pay-agent-reset" data-pay-agent-reset>
            Reset
          </button>
        </div>

        <div class="pay-agent-status-row">
          <span class="pay-agent-status-label">Status</span>
          <span class="pay-agent-status" data-pay-agent-status>ready</span>
        </div>

        <div class="pay-agent-messages" data-pay-agent-messages></div>

        <div class="pay-agent-actions" data-pay-agent-actions></div>

        <form class="pay-agent-form" data-pay-agent-form>
          <input
            class="pay-agent-input"
            data-pay-agent-input
            type="text"
            autocomplete="off"
            placeholder="Example: I want to pay 10 USDT to Brazil by PIX"
          />
          <button class="pay-agent-send" data-pay-agent-send type="submit">
            Send
          </button>
        </form>
      </div>
    `;

    const mount =
      document.querySelector("[data-pay-agent-mount]") ||
      document.querySelector("main") ||
      document.body;

    mount.appendChild(
      section
    );

    return section;
  }

  function bindElements(root) {
    state.root =
      root;

    state.messages =
      root.querySelector(
        SELECTORS.messages
      );

    state.form =
      root.querySelector(
        SELECTORS.form
      );

    state.input =
      root.querySelector(
        SELECTORS.input
      );

    state.send =
      root.querySelector(
        SELECTORS.send
      );

    state.actions =
      root.querySelector(
        SELECTORS.actions
      );

    state.status =
      root.querySelector(
        SELECTORS.status
      );

    state.reset =
      root.querySelector(
        SELECTORS.reset
      );
  }

  function bindEvents() {
    if (state.form) {
      state.form.addEventListener(
        "submit",
        handleSubmit
      );
    }

    if (state.reset) {
      state.reset.addEventListener(
        "click",
        handleReset
      );
    }
  }

  function restoreLastSnapshot() {
    const storage =
      getStorage();

    if (!storage || !storage.hasActivePlan()) {
      setStatus("ready");

      appendMessage(
        "assistant",
        "Tell me where you want to send the payment. For example: “I want to pay 10 USDT to Brazil by PIX.”"
      );

      return;
    }

    const last =
      normalizeObject(
        storage.getLastResponse()
      );

    appendMessage(
      "assistant",
      "I found your previous payment draft."
    );

    renderSafeSummary(last);

    if (last.reply || last.current_prompt) {
      appendMessage(
        "assistant",
        pickReplyText(last)
      );
    }

    setStatus(
      last.status || "ready"
    );

    renderFundingActions(last);
  }

  function init() {
    const root =
      document.querySelector(
        SELECTORS.root
      ) ||
      createDefaultRoot();

    bindElements(root);
    bindEvents();

    restoreLastSnapshot();

    if (state.input) {
      state.input.focus();
    }
  }

  return {
    init,
    handleSubmit,
    handleWalletFunding,
    handleReset
  };
})();

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      window.UnibridgePayAgentChat.init();
    }
  );
} else {
  window.UnibridgePayAgentChat.init();
}
