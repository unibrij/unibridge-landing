// pay/js/pay-agent-chat-url-picker.js

window.UnibridgePayAgentChatUrlPicker = (() => {
  function normalizeString(value) {
    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "object") {
      return "";
    }

    return String(value).trim();
  }

  function normalizeObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return value;
  }

  function pickUrlFromObject(value = {}) {
    const data =
      normalizeObject(value);

    return normalizeString(
      data.redirect_url ||
        data.handoff_url ||
        data.checkout_url ||
        data.widget_url ||
        data.fallback_widget_url ||
        data.url
    );
  }

  function pickRedirectUrl(result = {}) {
    const data =
      normalizeObject(result);

    const widget =
      normalizeObject(data.widget);

    const nextAction =
      normalizeObject(data.next_action);

    const meta =
      normalizeObject(nextAction.meta);

    const resultData =
      normalizeObject(data.result);

    const resultWidget =
      normalizeObject(resultData.widget);

    const resultNextAction =
      normalizeObject(resultData.next_action);

    const resultMeta =
      normalizeObject(resultNextAction.meta);

    return normalizeString(
      pickUrlFromObject(data) ||
        pickUrlFromObject(widget) ||
        pickUrlFromObject(nextAction) ||
        pickUrlFromObject(meta) ||
        pickUrlFromObject(resultData) ||
        pickUrlFromObject(resultWidget) ||
        pickUrlFromObject(resultNextAction) ||
        pickUrlFromObject(resultMeta)
    );
  }

  function pickClientSecret(result = {}) {
    const data =
      normalizeObject(result);

    const nextAction =
      normalizeObject(data.next_action);

    const meta =
      normalizeObject(nextAction.meta);

    const resultData =
      normalizeObject(data.result);

    const resultNextAction =
      normalizeObject(resultData.next_action);

    const resultMeta =
      normalizeObject(resultNextAction.meta);

    return normalizeString(
      data.client_secret ||
        meta.client_secret ||
        resultData.client_secret ||
        resultMeta.client_secret
    );
  }

  return {
    normalizeString,
    normalizeObject,
    pickUrlFromObject,
    pickRedirectUrl,
    pickClientSecret
  };
})();
