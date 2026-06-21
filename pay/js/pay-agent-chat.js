// pay/js/pay-agent-chat.js

window.UnibridgePayAgentChat = (() => {
  let autoHandoffInFlight = false;
  let lastAutoHandoffKey = "";
  let Handoff = null;

  function getDom() {
    return window.UnibridgePayAgentChatDom || null;
  }

  function getSelectors() {
    return window.UnibridgePayAgentChatSelectors || null;
  }

  function getRenderers() {
    return window.UnibridgePayAgentChatRenderers || null;
  }

  function getActions() {
    return window.UnibridgePayAgentChatActions || null;
  }

  function getPrivacy() {
    return window.UnibridgePayAgentChatPrivacy || null;
  }

  function getHandoffFactory() {
    return window.UnibridgePayAgentChatHandoffController || null;
  }

  function assertModules() {
    const Dom = getDom();
    const Selectors = getSelectors();
    const Renderers = getRenderers();
    const Actions = getActions();
    const Privacy = getPrivacy();

    if (!Dom || !Selectors || !Renderers || !Actions || !Privacy) {
      throw new Error("Pay Agent chat modules are not loaded.");
    }

    return { Dom, Selectors, Renderers, Actions, Privacy };
  }

  function normalizeString(value) {
    const Selectors = getSelectors();

    if (Selectors?.normalizeString) {
      return Selectors.normalizeString(value);
    }

    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "object") {
      return "";
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

  function pickSafeErrorText(error) {
    if (typeof error === "string") {
      return normalizeString(error);
    }

    if (!error || typeof error !== "object") {
      return "";
    }

    return normalizeString(
      error.user_message ||
        error.safe_message ||
        error.public_message ||
        error.message ||
        error.code
    );
  }

  function appendAssistantError(error) {
    const Renderers = getRenderers();
    const message = pickSafeErrorText(error);

    if (!message) {
      return;
    }

    Renderers?.appendMessage?.("assistant", message);
  }

  function appendUserSelection(label) {
    const Renderers = getRenderers();
    const text = normalizeString(label);

    if (!text) {
      return;
    }

    Renderers?.appendMessage?.("user", text, {
      compact: true
    });
  }

  function renderFallbackActions() {
    const { Renderers, Actions } = assertModules();

    const last =
      normalizeObject(
        Actions.getLastSafeResponse()
      );

    if (!Object.keys(last).length) {
      return;
    }

    Renderers.renderActions(last, {
      onOption: handleOptionSelection,
      onNextAction: handleNextAction
    });
  }

  function createHandoffController() {
    const Factory = getHandoffFactory();

    if (!Factory?.create) {
      throw new Error("Pay Agent handoff controller is not loaded.");
    }

    return Factory.create({
      assertModules,
      appendUserSelection,
      appendAssistantError,
      renderFallbackActions,

      getAutoHandoffInFlight() {
        return autoHandoffInFlight;
      },

      setAutoHandoffInFlight(value) {
        autoHandoffInFlight = Boolean(value);
      },

      getLastAutoHandoffKey() {
        return lastAutoHandoffKey;
      },

      setLastAutoHandoffKey(value) {
        lastAutoHandoffKey = normalizeString(value);
      }
    });
  }

  function getHandoffController() {
    if (!Handoff) {
      Handoff = createHandoffController();
    }

    return Handoff;
  }

  function handleResponse(response = {}) {
    const { Dom, Selectors, Renderers, Actions } = assertModules();
    const HandoffController = getHandoffController();

    const safeResponse = normalizeObject(response);

    Actions.saveChatResponse(safeResponse);
    Renderers.renderSafeSummary(safeResponse);

    const reply = Selectors.pickReplyText(safeResponse);

    if (reply) {
      Renderers.appendMessage("assistant", reply);
    }

    const status =
      Selectors.pickStatus(safeResponse) || "ready";

    Dom.setStatus(status);

    if (HandoffController.isAutoHandoffState(status)) {
      Dom.clearActions();
      HandoffController.scheduleAutoHandoff(safeResponse);
      return;
    }

    Renderers.renderActions(safeResponse, {
      onOption: handleOptionSelection,
      onNextAction: handleNextAction
    });
  }

  async function runBusyAction({
    status = "updating",
    label = "",
    task
  } = {}) {
    const { Dom } = assertModules();

    if (Dom.isBusy() || typeof task !== "function") {
      return;
    }

    Dom.clearActions();

    if (label) {
      appendUserSelection(label);
    }

    Dom.setBusy(true);
    Dom.setStatus(status);

    try {
      const response = await task();

      if (response) {
        handleResponse(response);
      }
    } catch (error) {
      appendAssistantError(error);
      Dom.setStatus("error");
    } finally {
      Dom.setBusy(false);
      Dom.focusInput();
    }
  }

  async function handleDeterministicPayload({
    label = "",
    payload = {},
    status = "updating"
  } = {}) {
    const Actions = getActions();

    await runBusyAction({
      status,
      label,
      task: () => Actions.sendActionPayload(payload)
    });
  }

  function handleOptionSelection(option = {}) {
    const { Selectors, Actions } = assertModules();
    const HandoffController = getHandoffController();

    const optionId =
      Selectors.normalizeOptionId(option);

    const label =
      Selectors.normalizeOptionLabel(option) ||
      optionId;

    if (!optionId) {
      return;
    }

    if (Selectors.isWalletFundingOption(option)) {
      HandoffController.handleWalletFunding({ label });
      return;
    }

    if (
      Selectors.isCardFundingOption(option) ||
      Selectors.isBankTransferFundingOption(option)
    ) {
      handleDeterministicPayload({
        label,
        payload:
          Actions.buildFundingMethodPayload(optionId)
      });

      return;
    }

    handleDeterministicPayload({
      label,
      payload:
        Actions.buildOptionPayload(option)
    });
  }

  function handleNextAction(nextAction = {}) {
    const { Selectors, Actions } = assertModules();
    const HandoffController = getHandoffController();

    const actionType =
      Selectors.normalizeLower(
        nextAction.type ||
          nextAction.action
      );

    const label =
      normalizeString(
        nextAction.label ||
          nextAction.title ||
          actionType
      );

    if (!actionType) {
      return;
    }

    if (
      actionType === "connect_wallet" ||
      actionType === "approve_wallet_payment"
    ) {
      HandoffController.handleWalletFunding({ label });
      return;
    }

    if (actionType === "open_card_checkout") {
      HandoffController.handleCardCheckout({ label });
      return;
    }

    if (actionType === "show_bank_transfer_instructions") {
      HandoffController.handleBankTransferInstructions({ label });
      return;
    }

    handleDeterministicPayload({
      label,
      payload:
        Actions.buildNextActionPayload(nextAction)
    });
  }

  async function handleSubmit(event) {
    if (event) {
      event.preventDefault();
    }

    const { Dom, Renderers, Actions, Privacy } = assertModules();

    if (Dom.isBusy()) {
      return;
    }

    const message = Dom.getInputValue();

    if (!message) {
      return;
    }

    Dom.clearActions();

    const visibleMessage =
      Privacy.getVisibleUserMessage(message);

    Renderers.appendMessage("user", visibleMessage, {
      masked:
        Privacy.isMaskedVisibleMessage(visibleMessage)
    });

    Dom.clearInput();
    Dom.setBusy(true);
    Dom.setStatus("thinking");

    try {
      const response =
        await Actions.sendChatMessage({
          message
        });

      handleResponse(response);
    } catch (error) {
      appendAssistantError(error);
      Dom.setStatus("error");
    } finally {
      Dom.setBusy(false);
      Dom.focusInput();
    }
  }

  function handleReset() {
    const { Dom, Actions } = assertModules();

    autoHandoffInFlight = false;
    lastAutoHandoffKey = "";

    Actions.clearStorage();

    Dom.clearMessages();
    Dom.clearActions();
    Dom.clearInput();
    Dom.setStatus("ready");
    Dom.focusInput();
  }

  function restoreLastSnapshot() {
    const { Dom, Selectors, Renderers, Actions } = assertModules();
    const HandoffController = getHandoffController();

    if (!Actions.hasActivePlan()) {
      Dom.setStatus("ready");
      return;
    }

    const last =
      normalizeObject(
        Actions.getLastSafeResponse()
      );

    if (!Object.keys(last).length) {
      Dom.setStatus("ready");
      return;
    }

    Renderers.renderSafeSummary(last);

    const reply =
      Selectors.pickReplyText(last);

    if (reply) {
      Renderers.appendMessage("assistant", reply);
    }

    const status =
      Selectors.pickStatus(last) || "ready";

    Dom.setStatus(status);

    if (HandoffController.isAutoHandoffState(status)) {
      Dom.clearActions();
      HandoffController.scheduleAutoHandoff(last);
      return;
    }

    Renderers.renderActions(last, {
      onOption: handleOptionSelection,
      onNextAction: handleNextAction
    });
  }

  function bindEvents() {
    const Dom = getDom();

    Dom.bindSubmit(handleSubmit);
    Dom.bindReset(handleReset);
  }

  function init() {
    const { Dom } = assertModules();

    Dom.mount();
    getHandoffController();
    bindEvents();
    restoreLastSnapshot();
    Dom.focusInput();
  }

  return {
    init,
    handleSubmit,
    handleReset,
    handleOptionSelection,
    handleNextAction,
    handleResponse,

    handleWalletFunding(...args) {
      return getHandoffController().handleWalletFunding(...args);
    },

    handleCardCheckout(...args) {
      return getHandoffController().handleCardCheckout(...args);
    },

    handleBankTransferInstructions(...args) {
      return getHandoffController().handleBankTransferInstructions(...args);
    }
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
