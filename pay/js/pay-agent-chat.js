// pay/js/pay-agent-chat.js

window.UnibridgePayAgentChat = (() => {
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

  function handleResponse(response = {}) {
    const { Dom, Selectors, Renderers, Actions } = assertModules();

    const safeResponse = normalizeObject(response);

    Actions.saveChatResponse(safeResponse);
    Renderers.renderSafeSummary(safeResponse);

    const reply = Selectors.pickReplyText(safeResponse);

    if (reply) {
      Renderers.appendMessage("assistant", reply);
    }

    Dom.setStatus(Selectors.pickStatus(safeResponse) || "ready");

    Renderers.renderActions(safeResponse, {
      onOption: handleOptionSelection,
      onNextAction: handleNextAction
    });
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

    const optionId = Selectors.normalizeOptionId(option);

    const label =
      Selectors.normalizeOptionLabel(option) ||
      optionId;

    if (!optionId) {
      return;
    }

    if (Selectors.isWalletFundingOption(option)) {
      handleWalletFunding({ label });
      return;
    }

    if (
      Selectors.isCardFundingOption(option) ||
      Selectors.isBankTransferFundingOption(option)
    ) {
      handleDeterministicPayload({
        label,
        payload: Actions.buildFundingMethodPayload(optionId)
      });

      return;
    }

    handleDeterministicPayload({
      label,
      payload: Actions.buildOptionPayload(option)
    });
  }

  function handleNextAction(nextAction = {}) {
    const { Selectors, Actions } = assertModules();

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
      handleWalletFunding({ label });
      return;
    }

    if (actionType === "open_card_checkout") {
      handleCardCheckout({ label });
      return;
    }

    if (actionType === "show_bank_transfer_instructions") {
      handleBankTransferInstructions({ label });
      return;
    }

    handleDeterministicPayload({
      label,
      payload: Actions.buildNextActionPayload(nextAction)
    });
  }

  async function handleWalletFunding({
    label = ""
  } = {}) {
    const { Dom, Renderers, Actions } = assertModules();

    if (Dom.isBusy()) {
      return;
    }

    Dom.clearActions();

    if (label) {
      appendUserSelection(label);
    }

    Dom.setBusy(true);
    Dom.setStatus("preparing_wallet_handoff");

    try {
      const result = await Actions.prepareWalletHandoff();

      const connectUrl =
        normalizeString(result.connect_url);

      if (!connectUrl) {
        const error = new Error("wallet_handoff_missing_connect_url");
        error.code = "wallet_handoff_missing_connect_url";
        throw error;
      }

      Dom.setStatus("opening_wallet_checkout");
      window.location.href = connectUrl;
    } catch (error) {
      appendAssistantError(error);
      Dom.setStatus("error");
      Dom.setBusy(false);

      const last = Actions.getLastSafeResponse();

      if (last && Object.keys(last).length) {
        Renderers.renderActions(last, {
          onOption: handleOptionSelection,
          onNextAction: handleNextAction
        });
      }

      Dom.focusInput();
    }
  }

  async function handleCardCheckout({
    label = ""
  } = {}) {
    const { Dom, Renderers, Actions } = assertModules();

    if (Dom.isBusy()) {
      return;
    }

    Dom.clearActions();

    if (label) {
      appendUserSelection(label);
    }

    Dom.setBusy(true);
    Dom.setStatus("preparing_card_checkout");

    try {
      const result = await Actions.prepareHandoff();

      const clientSecret =
        normalizeString(result.client_secret);

      if (!clientSecret) {
        const error = new Error("card_checkout_missing_client_secret");
        error.code = "card_checkout_missing_client_secret";
        throw error;
      }

      Dom.setStatus("card_checkout_ready");

      if (typeof Renderers.renderCardCheckout === "function") {
        Renderers.renderCardCheckout(result);
      } else if (typeof Renderers.renderEmbeddedOnramp === "function") {
        Renderers.renderEmbeddedOnramp(result);
      } else {
        Renderers.appendMessage(
          "assistant",
          "Card checkout is ready. Please complete the embedded checkout."
        );
      }
    } catch (error) {
      appendAssistantError(error);
      Dom.setStatus("error");

      const last = Actions.getLastSafeResponse();

      if (last && Object.keys(last).length) {
        Renderers.renderActions(last, {
          onOption: handleOptionSelection,
          onNextAction: handleNextAction
        });
      }
    } finally {
      Dom.setBusy(false);
      Dom.focusInput();
    }
  }

  async function handleBankTransferInstructions({
    label = ""
  } = {}) {
    const { Dom, Renderers, Actions } = assertModules();

    if (Dom.isBusy()) {
      return;
    }

    Dom.clearActions();

    if (label) {
      appendUserSelection(label);
    }

    Dom.setBusy(true);
    Dom.setStatus("preparing_bank_transfer_instructions");

    try {
      const result = await Actions.prepareHandoff();

      Dom.setStatus("bank_transfer_instructions_ready");

      if (typeof Renderers.renderBankTransferInstructions === "function") {
        Renderers.renderBankTransferInstructions(result);
      } else {
        Renderers.appendMessage(
          "assistant",
          "Bank transfer instructions are ready."
        );
      }
    } catch (error) {
      appendAssistantError(error);
      Dom.setStatus("error");

      const last = Actions.getLastSafeResponse();

      if (last && Object.keys(last).length) {
        Renderers.renderActions(last, {
          onOption: handleOptionSelection,
          onNextAction: handleNextAction
        });
      }
    } finally {
      Dom.setBusy(false);
      Dom.focusInput();
    }
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
      masked: Privacy.isMaskedVisibleMessage(visibleMessage)
    });

    Dom.clearInput();
    Dom.setBusy(true);
    Dom.setStatus("thinking");

    try {
      const response =
        await Actions.sendChatMessage({ message });

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

    Actions.clearStorage();

    Dom.clearMessages();
    Dom.clearActions();
    Dom.clearInput();
    Dom.setStatus("ready");
    Dom.focusInput();
  }

  function restoreLastSnapshot() {
    const { Dom, Selectors, Renderers, Actions } = assertModules();

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

    Dom.setStatus(
      Selectors.pickStatus(last) || "ready"
    );

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
    handleWalletFunding,
    handleCardCheckout,
    handleBankTransferInstructions,
    handleResponse
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
