
// unibridge-landing/surface/executor-availability.js

import {
  getExecutorAvailability
} from "/shared/executor-availability/index.js";


export function createSurfaceExecutorAvailability({
  state,
  quoteBox,
  getValue,
  getReceiverCountry,
  continueFlow,
  setStatus
}) {
  const notice = document.createElement("section");
  notice.className = "ub-executor-notice";
  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");
  notice.hidden = true;

  // Display the notice above Get quote.
  const quoteButton =
    getValue("sendBtn") ||
    document.getElementById("sendBtn");

  (quoteButton || quoteBox).before(notice);

  let refreshId = 0;
  let checking = false;

  function show(result) {
    const status = !state.settlementId
      ? result?.status
      : null;

    if (!status || status === "live") {
      notice.hidden = true;
      notice.replaceChildren();
      return;
    }

    notice.dataset.status = status;

    const icon = document.createElement("span");
    icon.className = "ub-executor-notice__icon";
    icon.setAttribute("aria-hidden", "true");

    icon.textContent =
      status === "testing" ? "⚠" :
      status === "paused" ? "⛔" : "ⓘ";

    const content = document.createElement("div");
    content.className = "ub-executor-notice__content";

    const label = document.createElement("span");
    label.className = "ub-executor-notice__tag";

    label.textContent =
      status === "testing" ? "TESTING" :
      status === "paused" ? "PAUSED" : "UNVERIFIED";

    const heading = document.createElement("strong");
    heading.className = "ub-executor-notice__heading";

    heading.textContent =
      status === "paused"
        ? "Route unavailable"
        : result.label || "Availability not verified";

    const message = document.createElement("p");
    message.className = "ub-executor-notice__message";
    message.textContent = result.message || "";

    content.append(label, heading, message);

    notice.replaceChildren(icon, content);
    notice.hidden = false;
  }

  async function refresh() {
    const id = ++refreshId;
    const country = getReceiverCountry();
    const route = state.currentRouteQuote?.route ?? null;

    // Availability belongs to the selected executor,
    // never to the destination country as a whole.
    if (
      !country ||
      !route?.executor ||
      state.settlementId
    ) {
      show(null);
      return;
    }

    let availability;

    try {
      availability = await getExecutorAvailability({
        executor_id: route.executor,
        country
      });
    } catch {
      availability = {
        status: "unknown",
        label: "Availability not verified",
        message: "Payout route availability could not be verified.",
        available: null
      };
    }

    // Ignore stale results when the user changes the route.
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

    // Existing settlements may resume their funding.
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

      // Ignore stale quotes or changed destinations.
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
    getValue("country")?.addEventListener(
      "change",
      refresh
    );

    getValue("source_country")?.addEventListener(
      "change",
      refresh
    );

    getValue("amount")?.addEventListener(
      "input",
      refresh
    );

    window.addEventListener(
      "unibridge:quote",
      refresh
    );

    void refresh();
  }

  return {
    bind,
    guardedContinue
  };
}
