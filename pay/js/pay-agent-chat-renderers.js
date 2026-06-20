// pay/js/pay-agent-chat-renderers.js

window.UnibridgePayAgentChatRenderers = (() => {
  const Messages =
    window.UnibridgePayAgentChatMessageRenderers;

  const Summary =
    window.UnibridgePayAgentChatSummaryRenderers;

  const Actions =
    window.UnibridgePayAgentChatActionRenderers;

  const Handoff =
    window.UnibridgePayAgentChatHandoffRenderers;

  if (!Messages || !Summary || !Actions || !Handoff) {
    throw new Error("Pay Agent renderer modules are not loaded.");
  }

  return {
    appendMessage:
      Messages.appendMessage,

    renderSafeSummary:
      Summary.renderSafeSummary,

    renderAvailableOptions:
      Actions.renderAvailableOptions,

    renderNextAction:
      Actions.renderNextAction,

    renderActions:
      Actions.renderActions,

    renderCardCheckout:
      Handoff.renderCardCheckout,

    renderBankTransferInstructions:
      Handoff.renderBankTransferInstructions,

    shouldRenderAvailableOptions:
      Actions.shouldRenderAvailableOptions,

    shouldRenderNextAction:
      Actions.shouldRenderNextAction,

    createActionButton:
      Actions.createActionButton,

    clearMessages:
      Messages.clearMessages,

    clearActions:
      Messages.clearActions
  };
})();
