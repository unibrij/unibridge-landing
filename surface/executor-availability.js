
 // unibridge-landing/surface/executor-availability.js

import {
  loadExecutorAvailability,
  getExecutorAvailability,
  describeExecutorAvailability
} from "/shared/executor-availability/index.js";


export function createSurfaceExecutorAvailability({
  state,
  quoteBox,
  getValue,
  getReceiverCountry,
  continueFlow,
  setStatus
}) {
  const notice = document.createElement("div");
  notice.className = "status-box";
  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");
  notice.hidden = true;
  quoteBox.before(notice);

  let refreshId = 0;
  let checking = false;

  function show(result) {
    const visible =
      !state.settlementId &&
      result &&
      result.status !== "live";

    notice.hidden = !visible;
    notice.textContent = visible
      ? [result.label, result.message].filter(Boolean).join(" — ")
      : "";
  }

  async function refresh() {
    const id = ++refreshId;
    const country = getReceiverCountry();
    const route = state.currentRouteQuote?.route ?? null;

    if (!country || state.settlementId) {
      show(null);
      return;
    }

    let availability = null;

    if (route) {
      availability = await getExecutorAvailability({
        executor_id: route.executor,
        country
      });
    } else {
      // Before quoting, show a country-level notice only
      // when every registered executor has the same status.
      try {
        const states = await loadExecutorAvailability();
        const matches = [...states.values()].filter(
          item => item.country === country
        );

        if (
          matches.length &&
          matches.every(item => item.status === matches[0].status)
        ) {
          availability = describeExecutorAvailability(matches[0].status);
        }
      } catch {
        availability = describeExecutorAvailability("unknown");
      }
    }

    if (
      id !== refreshId ||
      country !== getReceiverCountry() ||
      route !== (state.currentRouteQuote?.route ?? null) ||
      state.settlementId
    ) {
      return;
    }

    show(availability);
  }

  async function guardedContinue() {
    if (checking || state.processing) return;

    // A created settlement can always resume its existing funding.
    if (state.settlementId || state.pendingWidgetUrl) {
      return continueFlow();
    }

    const route = state.currentRouteQuote?.route;

    if (!route?.executor) {
      setStatus(
        "Select a payout route before continuing.",
        "error"
      );
      return;
    }

    const country = getReceiverCountry();
    checking = true;

    try {
      const availability = await getExecutorAvailability({
        executor_id: route.executor,
        country,
        force: true
      });

      // Ignore a result from a quote the user has since changed.
      if (
        route !== state.currentRouteQuote?.route ||
        country !== getReceiverCountry() ||
        state.settlementId
      ) {
        return;
      }

      show(availability);

      if (availability.available !== true) {
        setStatus(
          availability.message ||
            "Payout route availability could not be verified.",
          "error"
        );
        return;
      }

      return await continueFlow();
    } catch (error) {
      setStatus(error, "error");
    } finally {
      checking = false;
    }
  }

  function bind() {
    getValue("country")?.addEventListener("change", refresh);
    getValue("source_country")?.addEventListener("change", refresh);
    getValue("amount")?.addEventListener("input", refresh);
    window.addEventListener("unibridge:quote", refresh);
    void refresh();
  }

  return { bind, guardedContinue };
}
