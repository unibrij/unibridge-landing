// pay/js/pay-agent-chat-action-renderers.js

window.UnibridgePayAgentChatActionRenderers = (() => {
  const Core =
    window.UnibridgePayAgentChatRendererCore;

  if (!Core) {
    throw new Error("Pay Agent renderer core is not loaded.");
  }

  const HIDDEN_NEXT_ACTION_TYPES =
    new Set([
      "ask_language",
      "ask_destination",
      "ask_funding_type",
      "ask_stablecoin_asset",
      "ask_fiat_currency",
      "ask_amount",
      "ask_beneficiary",
      "needs_clarification"
    ]);

  function createActionButton(label, onClick, options = {}) {
    const safeLabel =
      Core.normalizeString(label);

    if (!safeLabel) {
      return null;
    }

    const button =
      Core.createElement(
        "button",
        options.secondary
          ? "pay-agent-action-button pay-agent-action-secondary"
          : "pay-agent-action-button",
        ""
      );

    button.type =
      "button";

    button.appendChild(
      Core.createElement(
        "span",
        "pay-agent-action-label",
        safeLabel
      )
    );

    const description =
      Core.normalizeString(
        options.description
      );

    if (description) {
      button.appendChild(
        Core.createElement(
          "span",
          "pay-agent-action-meta",
          description
        )
      );
    }

    if (typeof onClick === "function") {
      button.addEventListener(
        "click",
        onClick
      );
    }

    return button;
  }

  function shouldRenderAvailableOptions(response = {}) {
    const Selectors =
      Core.getSelectors();

    if (!Selectors) {
      return false;
    }

    const status =
      Selectors.pickStatus(response);

    if (
      status === "language_required" ||
      status === "destination_required" ||
      status === "amount_required" ||
      status === "beneficiary_required"
    ) {
      return false;
    }

    return Selectors.hasAvailableOptions(response);
  }

  function renderAvailableOptions(
    response = {},
    handlers = {}
  ) {
    const Dom =
      Core.getDom();

    const Selectors =
      Core.getSelectors();

    if (!Dom || !Selectors) {
      return false;
    }

    const options =
      Selectors.pickAvailableOptions(response);

    if (!options.length) {
      return false;
    }

    const group =
      Core.createElement(
        "div",
        "pay-agent-option-group"
      );

    options.forEach((option) => {
      const label =
        Selectors.normalizeOptionLabel(option);

      if (!label) {
        return;
      }

      const button =
        createActionButton(
          label,
          () => {
            handlers.onOption?.(
              option
            );
          },
          {
            description:
              Selectors.normalizeOptionDescription(option),
            secondary:
              true
          }
        );

      if (button) {
        group.appendChild(button);
      }
    });

    if (!group.childNodes.length) {
      return false;
    }

    Dom.appendToActions(group);

    return true;
  }

  function shouldRenderNextAction(response = {}) {
    const Selectors =
      Core.getSelectors();

    if (!Selectors) {
      return false;
    }

    const actionType =
      Selectors.pickNextActionType(response);

    return Boolean(
      actionType &&
        !HIDDEN_NEXT_ACTION_TYPES.has(actionType)
    );
  }

  function renderNextAction(
    response = {},
    handlers = {}
  ) {
    const Dom =
      Core.getDom();

    const Selectors =
      Core.getSelectors();

    if (!Dom || !Selectors) {
      return false;
    }

    if (!shouldRenderNextAction(response)) {
      return false;
    }

    const nextAction =
      Selectors.pickNextAction(response);

    const label =
      Selectors.pickNextActionLabel(response);

    if (!label) {
      return false;
    }

    const button =
      createActionButton(
        label,
        () => {
          handlers.onNextAction?.(
            nextAction
          );
        }
      );

    if (!button) {
      return false;
    }

    Dom.appendToActions(button);

    return true;
  }

  function renderActions(
    response = {},
    handlers = {}
  ) {
    const Dom =
      Core.getDom();

    if (!Dom) {
      return;
    }

    Dom.clearActions();

    if (shouldRenderAvailableOptions(response)) {
      renderAvailableOptions(
        response,
        handlers
      );

      return;
    }

    if (shouldRenderNextAction(response)) {
      renderNextAction(
        response,
        handlers
      );
    }
  }

  function clearActions() {
    Core.getDom()?.clearActions?.();
  }

  return {
    createActionButton,

    renderAvailableOptions,
    renderNextAction,
    renderActions,

    shouldRenderAvailableOptions,
    shouldRenderNextAction,

    clearActions
  };
})();
