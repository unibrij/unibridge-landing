// pay/js/pay-agent-chat-renderers.js

/*
--------------------------------------------------
Pay Agent Chat Renderers

Responsibility:
- Render chat messages.
- Render safe review summary cards.
- Render available option buttons.
- Render next_action buttons.
- Keep UI rendering separate from API/action execution.

Does not:
- Call backend APIs.
- Read/write storage.
- Decide Pay Agent state transitions.
- Build normalized_intent.
- Mask private values.
--------------------------------------------------
*/

window.UnibridgePayAgentChatRenderers = (() => {
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

  function getDom() {
    return window.UnibridgePayAgentChatDom || null;
  }

  function getSelectors() {
    return window.UnibridgePayAgentChatSelectors || null;
  }

  function isPlainObject(value) {
    return Boolean(
      value &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
  }

  function normalizeString(value) {
    const Selectors =
      getSelectors();

    if (
      value === null ||
      value === undefined
    ) {
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

    /*
    Never render objects as chat text.
    This prevents "[object Object]" from appearing in the UI.
    */
    if (typeof value === "object") {
      return "";
    }

    if (Selectors?.normalizeString) {
      return Selectors.normalizeString(value);
    }

    return String(value).trim();
  }

  function normalizeObject(value) {
    const Selectors =
      getSelectors();

    if (Selectors?.normalizeObject) {
      return Selectors.normalizeObject(value);
    }

    if (!isPlainObject(value)) {
      return {};
    }

    return value;
  }

  function normalizeArray(value) {
    const Selectors =
      getSelectors();

    if (Selectors?.normalizeArray) {
      return Selectors.normalizeArray(value);
    }

    return Array.isArray(value)
      ? value
      : [];
  }

  function createElement(tag, className, text = "") {
    const Dom =
      getDom();

    if (Dom?.createElement) {
      return Dom.createElement(
        tag,
        className,
        normalizeString(text)
      );
    }

    const element =
      document.createElement(tag);

    if (className) {
      element.className =
        className;
    }

    const safeText =
      normalizeString(text);

    if (safeText) {
      element.textContent =
        safeText;
    }

    return element;
  }

  function appendMessage(role, text, options = {}) {
    const Dom =
      getDom();

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

    Dom?.appendToMessages?.(
      message
    );

    return message;
  }

  function formatSummaryValue(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    if (
      typeof value === "string" ||
      typeof value === "number"
    ) {
      return normalizeString(value);
    }

    return "";
  }

  function appendSummaryRow(card, label, value) {
    const safeValue =
      formatSummaryValue(value);

    if (!safeValue) {
      return;
    }

    const row =
      createElement(
        "div",
        "pay-agent-info-panel-row"
      );

    row.appendChild(
      createElement(
        "span",
        "pay-agent-info-panel-label",
        label
      )
    );

    row.appendChild(
      createElement(
        "span",
        "pay-agent-info-panel-value",
        safeValue
      )
    );

    card.appendChild(
      row
    );
  }

  function buildDestinationSummary(destination = {}) {
    const item =
      normalizeObject(destination);

    return normalizeString(
      item.label ||
        [
          item.country_name,
          item.payout_rail
        ]
          .filter(Boolean)
          .join(" · ")
    );
  }

  function buildAmountSummary(summary = {}) {
    const item =
      normalizeObject(summary);

    return normalizeString(
      [
        item.amount,
        item.amount_currency
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  function buildRecipientSummary(beneficiary = {}) {
    const item =
      normalizeObject(beneficiary);

    if (item.fields_total === undefined) {
      return "";
    }

    const collected =
      normalizeArray(
        item.fields_collected
      ).length;

    return `${collected}/${item.fields_total} fields added`;
  }

  function renderSafeSummary(response = {}) {
    const Dom =
      getDom();

    const Selectors =
      getSelectors();

    if (!Dom || !Selectors) {
      return null;
    }

    if (!Selectors.isReviewState(response)) {
      return null;
    }

    const summary =
      Selectors.pickSafeSummary(response);

    if (!Object.keys(summary).length) {
      return null;
    }

    const card =
      createElement(
        "div",
        "pay-agent-info-panel"
      );

    card.appendChild(
      createElement(
        "div",
        "pay-agent-info-panel-title",
        "Review payment"
      )
    );

    appendSummaryRow(
      card,
      "Destination",
      buildDestinationSummary(
        normalizeObject(summary.destination)
      )
    );

    appendSummaryRow(
      card,
      "Amount",
      buildAmountSummary(summary)
    );

    appendSummaryRow(
      card,
      "Funding",
      summary.selected_funding_method ||
        summary.funding_type
    );

    appendSummaryRow(
      card,
      "Asset",
      summary.asset
    );

    appendSummaryRow(
      card,
      "Currency",
      summary.fiat_currency
    );

    appendSummaryRow(
      card,
      "Recipient",
      buildRecipientSummary(
        normalizeObject(summary.beneficiary)
      )
    );

    Dom.appendToMessages(
      card
    );

    return card;
  }

  function createActionButton(label, onClick, options = {}) {
    const safeLabel =
      normalizeString(label);

    if (!safeLabel) {
      return null;
    }

    const button =
      createElement(
        "button",
        options.secondary
          ? "pay-agent-action-button pay-agent-action-secondary"
          : "pay-agent-action-button",
        ""
      );

    button.type =
      "button";

    button.appendChild(
      createElement(
        "span",
        "pay-agent-action-label",
        safeLabel
      )
    );

    const description =
      normalizeString(options.description);

    if (description) {
      button.appendChild(
        createElement(
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

  function renderAvailableOptions(
    response = {},
    handlers = {}
  ) {
    const Dom =
      getDom();

    const Selectors =
      getSelectors();

    if (!Dom || !Selectors) {
      return false;
    }

    const options =
      Selectors.pickAvailableOptions(response);

    if (!options.length) {
      return false;
    }

    const group =
      createElement(
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
            handlers.onOption?.(option);
          },
          {
            description:
              Selectors.normalizeOptionDescription(option),
            secondary:
              true
          }
        );

      if (button) {
        group.appendChild(
          button
        );
      }
    });

    if (!group.childNodes.length) {
      return false;
    }

    Dom.appendToActions(
      group
    );

    return true;
  }

  function shouldRenderAvailableOptions(response = {}) {
    const Selectors =
      getSelectors();

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

  function shouldRenderNextAction(response = {}) {
    const Selectors =
      getSelectors();

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
      getDom();

    const Selectors =
      getSelectors();

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

    Dom.appendToActions(
      button
    );

    return true;
  }

  function renderActions(
    response = {},
    handlers = {}
  ) {
    const Dom =
      getDom();

    const Selectors =
      getSelectors();

    if (!Dom || !Selectors) {
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

  function clearMessages() {
    getDom()?.clearMessages?.();
  }

  function clearActions() {
    getDom()?.clearActions?.();
  }

  return {
    appendMessage,

    renderSafeSummary,
    renderAvailableOptions,
    renderNextAction,
    renderActions,

    shouldRenderAvailableOptions,
    shouldRenderNextAction,

    createActionButton,

    clearMessages,
    clearActions
  };
})();
