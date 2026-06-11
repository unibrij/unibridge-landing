// unibrij/unibridge-landing/surface/js/nextAction.js

window.UnibridgeNextAction = (() => {
  function normalizeNextAction(action) {
    if (!action || typeof action !== "object") {
      return null;
    }

    const type =
      typeof action.type === "string"
        ? action.type.trim().toLowerCase()
        : action.step
          ? "step"
          : (
              action.url ||
              action.redirect_url ||
              action.fallback_widget_url
            )
            ? "redirect"
            : null;

    if (!type) {
      return null;
    }

    const provider =
      typeof action.provider === "string"
        ? action.provider.trim()
        : null;

    const step =
      typeof action.step === "string"
        ? action.step.trim()
        : null;

    const meta =
      action.meta &&
      typeof action.meta === "object" &&
      !Array.isArray(action.meta)
        ? { ...action.meta }
        : {};

    const url =
      (typeof action.url === "string" && action.url.trim()) ||
      (typeof action.redirect_url === "string" && action.redirect_url.trim()) ||
      (typeof action.fallback_widget_url === "string" && action.fallback_widget_url.trim()) ||
      (typeof meta.url === "string" && meta.url.trim()) ||
      (typeof meta.redirect_url === "string" && meta.redirect_url.trim()) ||
      (typeof meta.fallback_widget_url === "string" && meta.fallback_widget_url.trim()) ||
      null;

    return {
      type,
      provider,
      step: type === "step" ? step : null,
      url: type === "redirect" ? url : null,
      label:
        typeof action.label === "string"
          ? action.label.trim()
          : null,
      blocking:
        typeof action.blocking === "boolean"
          ? action.blocking
          : true,
      meta
    };
  }

  function extractWidgetUrlFromFunding(funding) {
    const normalizedAction =
      normalizeNextAction(funding?.next_action);

    return (
      funding?.widget?.url ||
      funding?.widget_url ||
      normalizedAction?.url ||
      normalizedAction?.meta?.fallback_widget_url ||
      normalizedAction?.meta?.redirect_url ||
      normalizedAction?.meta?.url ||
      null
    );
  }

  return {
    normalizeNextAction,
    extractWidgetUrlFromFunding
  };
})();
