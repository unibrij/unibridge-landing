// pay/js/pay-agent-chat.js

/*
--------------------------------------------------
Pay Agent Chat Controller v3

Responsibility:
- Coordinate DOM, renderers, actions, selectors, and privacy modules.
- Send the user's real first message to backend.
- Handle option clicks and next_action clicks.
- Keep the empty chat placeholder purely visual via CSS.
- Keep controller small and orchestration-only.

Does not:
- Render DOM directly except through renderers/dom modules.
- Call backend directly except through actions module.
- Store beneficiary / PIX key in localStorage.
- Build normalized_intent.
- Decide route client-side.
- Execute payout.
--------------------------------------------------
*/

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

    return {
      Dom,
      Selectors,
      Renderers,
      Actions,
      Privacy
    };
  }

  function normalizeString(value) {
    const Selectors = getSelectors();

    if (Selectors?.normalizeString) {
      return Selectors.normalizeString(value);
    }

    if (value === null || value === undefined) {
      return "";
    }

    return String(value).trim();
  }

  function normalizeObject(value) {
    const Selectors = getSelectors();

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

  function appendAssistantError(message) {
    const Renderers = getRenderers();

    Renderers?.appendMessage?.(
      "assistant",
      message || "Something went wrong. Please try again."
    );
  }

  function handleResponse(response = {}) {
    const {
      Dom,
      Selectors,
      Renderers,
      Actions
    } = assertModules();

    const safeResponse = normalizeObject(response);

    Actions.saveChatResponse(safeResponse);

    Renderers.renderSafeSummary(safeResponse);

    const reply = Selectors.pickReplyText(safeResponse);

    if (reply) {
      Renderers.appendMessage(
        "assistant",
        reply
      );
    }

    Dom.setStatus(
      Selectors.pickStatus(safeResponse) ||
        "ready"
    );

    Renderers.renderActions(
      safeResponse,
      {
        onOption:
          handleOptionSelection,

        onNextAction:
          handleNextAction
      }
    );
  }

  function appendUserSelection(label) {
    const Renderers = getRenderers();

    const text = normalizeString(label);

    if (!text) {
      return;
    }

    Renderers?.appendMessage?.(
      "user",
      text,
      {
        compact:
          true
      }
    );
  }

  async function runBusyAction({
    status = "updating",
    label = "",
    task
  } = {}) {
    const {
      Dom
    } = assertModules();

    if (Dom.isBusy()) {
      return;
    }

    if (typeof task !== "function") {
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
      appendAssistantError(error?.message);
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

      task:
        () => Actions.sendActionPayload(payload)
    });
  }

  function handleOptionSelection(option = {}) {
    const {
      Selectors,
      Actions
    } = assertModules();

    const optionId =
      Selectors.normalizeOptionId(option);

    const label =
      Selectors.normalizeOptionLabel(option) ||
      optionId;

    if (!optionId) {
      return;
    }

    if (Selectors.isWalletFundingOption(option)) {
      handleWalletFunding({
        label
      });

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
    const {
      Selectors,
      Actions
    } = assertModules();

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
      handleWalletFunding({
        label
      });

      return;
    }

    handleDeterministicPayload({
      label,

      payload:
        Actions.buildNextActionPayload(nextAction)
    });
  }

  async function handleWalletFunding({
    label = ""
  } = {}) {
    const {
      Dom,
      Renderers,
      Actions
    } = assertModules();

    if (Dom.isBusy()) {
      return;
    }

    Dom.clearActions();

    if (label) {
      appendUserSelection(label);
    }

    Dom.setBusy(true);
    Dom.setStatus("preparing wallet handoff");

    Renderers.appendMessage(
      "assistant",
      "تمام، عم حضّر ربط المحفظة..."
    );

    try {
      const result =
        await Actions.prepareWalletHandoff();

      const connectUrl =
        normalizeString(result.connect_url);

      if (!connectUrl) {
        throw new Error(
          "Wallet checkout is not ready yet. Please try again."
        );
      }

      Dom.setStatus("opening wallet checkout");

      window.location.href =
        connectUrl;
    } catch (error) {
      appendAssistantError(
        error?.message ||
          "Could not prepare wallet checkout."
      );

      Dom.setStatus("error");
      Dom.setBusy(false);

      const last =
        Actions.getLastSafeResponse();

      if (last && Object.keys(last).length) {
        Renderers.renderActions(
          last,
          {
            onOption:
              handleOptionSelection,

            onNextAction:
              handleNextAction
          }
        );
      }

      Dom.focusInput();
    }
  }

  async function handleSubmit(event) {
    if (event) {
      event.preventDefault();
    }

    const {
      Dom,
      Renderers,
      Actions,
      Privacy
    } = assertModules();

    if (Dom.isBusy()) {
      return;
    }

    const message =
      Dom.getInputValue();

    if (!message) {
      return;
    }

    Dom.clearActions();

    const visibleMessage =
      Privacy.getVisibleUserMessage(message);

    Renderers.appendMessage(
      "user",
      visibleMessage,
      {
        masked:
          Privacy.isMaskedVisibleMessage(visibleMessage)
      }
    );

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
      appendAssistantError(error?.message);
      Dom.setStatus("error");
    } finally {
      Dom.setBusy(false);
      Dom.focusInput();
    }
  }

  function handleReset() {
    const {
      Dom,
      Actions
    } = assertModules();

    Actions.clearStorage();

    Dom.clearMessages();
    Dom.clearActions();
    Dom.clearInput();
    Dom.setStatus("ready");
    Dom.focusInput();
  }

  function restoreLastSnapshot() {
    const {
      Dom,
      Selectors,
      Renderers,
      Actions
    } = assertModules();

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
      Renderers.appendMessage(
        "assistant",
        reply
      );
    }

    Dom.setStatus(
      Selectors.pickStatus(last) ||
        "ready"
    );

    Renderers.renderActions(
      last,
      {
        onOption:
          handleOptionSelection,

        onNextAction:
          handleNextAction
      }
    );
  }

  function bindEvents() {
    const Dom = getDom();

    Dom.bindSubmit(handleSubmit);
    Dom.bindReset(handleReset);
  }

  function init() {
    const {
      Dom
    } = assertModules();

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
