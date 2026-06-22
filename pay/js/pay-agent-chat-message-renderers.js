// pay/js/pay-agent-chat-message-renderers.js

window.UnibridgePayAgentChatMessageRenderers = (() => {
  const Core =
    window.UnibridgePayAgentChatRendererCore;

  if (!Core) {
    throw new Error("Pay Agent renderer core is not loaded.");
  }

  function isBlockedObjectString(value) {
    return (
      value === "[object Object]" ||
      value === "object Object" ||
      value === "[object object]"
    );
  }

  function appendMessage(role, text, options = {}) {
    const Dom =
      Core.getDom();

    const messageText =
      Core.normalizeString(text);

    if (
      !messageText ||
      isBlockedObjectString(messageText)
    ) {
      console.warn("[PAY_AGENT_BLOCKED_OBJECT_MESSAGE]", {
        role,
        raw:
          text
      });

      return null;
    }

    const safeRole =
      Core.normalizeString(role) ||
      "assistant";

    const message =
      Core.createElement(
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

    Dom?.appendToMessages?.(
      message
    );

    return message;
  }

  function clearMessages() {
    Core.getDom()?.clearMessages?.();
  }

  function clearActions() {
    Core.getDom()?.clearActions?.();
  }

  return {
    appendMessage,
    clearMessages,
    clearActions
  };
})();
