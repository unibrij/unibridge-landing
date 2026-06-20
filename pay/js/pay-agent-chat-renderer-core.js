// pay/js/pay-agent-chat-renderer-core.js

window.UnibridgePayAgentChatRendererCore = (() => {
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
    const Selectors = getSelectors();

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
      return "";
    }

    if (Selectors?.normalizeString) {
      return Selectors.normalizeString(value);
    }

    return String(value).trim();
  }

  function normalizeObject(value) {
    const Selectors = getSelectors();

    if (Selectors?.normalizeObject) {
      return Selectors.normalizeObject(value);
    }

    return isPlainObject(value)
      ? value
      : {};
  }

  function normalizeArray(value) {
    const Selectors = getSelectors();

    if (Selectors?.normalizeArray) {
      return Selectors.normalizeArray(value);
    }

    return Array.isArray(value)
      ? value
      : [];
  }

  function createElement(tag, className, text = "") {
    const Dom = getDom();

    if (Dom?.createElement) {
      return Dom.createElement(
        tag,
        className,
        normalizeString(text)
      );
    }

    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    const safeText = normalizeString(text);

    if (safeText) {
      element.textContent = safeText;
    }

    return element;
  }

  function formatSummaryValue(value) {
    if (value === null || value === undefined) {
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
    const safeValue = formatSummaryValue(value);

    if (!safeValue) {
      return;
    }

    const row = createElement(
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

    card.appendChild(row);
  }

  return {
    getDom,
    getSelectors,
    normalizeString,
    normalizeObject,
    normalizeArray,
    createElement,
    formatSummaryValue,
    appendSummaryRow
  };
})();
