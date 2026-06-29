// fiat/bank-transfer/js/flowUi.js

const entryBox =
  document.getElementById("entryBox");

const fundingBox =
  document.getElementById("fundingBox");

const quoteButton =
  document.getElementById("quoteAction");

const createSettlementButton =
  document.getElementById("createSettlementAction");

const primaryButton =
  document.getElementById("primaryAction");

const refreshButton =
  document.getElementById("refreshStatus");

const newTransferButton =
  document.getElementById("newTransferAction");

function getEl(id) {
  return document.getElementById(id);
}

function getRouteFieldContainer() {
  const routeSelect =
    getEl("routeId");

  return (
    routeSelect?.closest(".route-grid") ||
    routeSelect?.closest(".field") ||
    routeSelect?.parentElement ||
    null
  );
}

function resetQuoteStageUi() {
  const routeSelect =
    getEl("routeId");

  const destinationFields =
    getEl("destinationFields");

  const quoteBox =
    getEl("quoteBox");

  if (routeSelect) {
    routeSelect.disabled =
      true;

    routeSelect.innerHTML =
      `<option value="">Get quote first</option>`;
  }

  if (destinationFields) {
    destinationFields.innerHTML =
      "";

    destinationFields.classList.add(
      "hidden"
    );
  }

  getRouteFieldContainer()
    ?.classList.add("hidden");

  quoteBox?.classList.add(
    "hidden"
  );
}

export function showEntryMode() {
  entryBox?.classList.remove("hidden");
  fundingBox?.classList.add("hidden");
}

export function showFundingMode() {
  entryBox?.classList.add("hidden");
  fundingBox?.classList.remove("hidden");
}

export function setQuoteButton({
  label,
  disabled
} = {}) {
  if (!quoteButton) {
    return;
  }

  if (label) {
    quoteButton.textContent =
      label;
  }

  quoteButton.disabled =
    Boolean(disabled);
}

export function setCreateSettlementButton({
  label,
  disabled
} = {}) {
  if (!createSettlementButton) {
    return;
  }

  if (label) {
    createSettlementButton.textContent =
      label;
  }

  createSettlementButton.disabled =
    Boolean(disabled);
}

export function setEntryButtonsForQuoteStart() {
  setQuoteButton({
    label:
      "Getting quote…",

    disabled:
      true
  });

  setCreateSettlementButton({
    label:
      "Create payout route",

    disabled:
      true
  });
}

export function setEntryButtonsForQuoteReady({
  hasPreparedQuote
} = {}) {
  const ready =
    Boolean(hasPreparedQuote);

  setCreateSettlementButton({
    label:
      "Create payout route",

    disabled:
      !ready
  });

  setQuoteButton({
    label:
      ready
        ? "Quote ready"
        : "Get quote",

    disabled:
      ready
  });
}

export function setEntryButtonsForQuoteIdle({
  hasFiatContext
} = {}) {
  setQuoteButton({
    label:
      hasFiatContext
        ? "Get quote"
        : "Start from Pay with UniBridge",

    disabled:
      false
  });

  setCreateSettlementButton({
    label:
      "Create payout route",

    disabled:
      true
  });
}

export function setEntryButtonsForPreparing() {
  setQuoteButton({
    label:
      "Preparing…",

    disabled:
      true
  });

  setCreateSettlementButton({
    label:
      "Create payout route",

    disabled:
      true
  });
}

export function setCreateSettlementBusy() {
  setCreateSettlementButton({
    label:
      "Creating route…",

    disabled:
      true
  });
}

export function setCreateSettlementIdle({
  hasPreparedQuote
} = {}) {
  setCreateSettlementButton({
    label:
      "Create payout route",

    disabled:
      !Boolean(hasPreparedQuote)
  });
}

export function resetEntryButtonsAfterAuthReset({
  hasFiatContext
} = {}) {
  setEntryButtonsForQuoteIdle({
    hasFiatContext
  });
}

export function attachBankTransferEvents({
  handleQuote,
  handleCreateSettlement,
  runBankTransferFlow,
  startNewTransfer,
  handleEntryChanged,
  hasFiatContext
} = {}) {
  quoteButton?.addEventListener(
    "click",
    handleQuote
  );

  createSettlementButton?.addEventListener(
    "click",
    handleCreateSettlement
  );

  primaryButton?.addEventListener(
    "click",
    runBankTransferFlow
  );

  refreshButton?.addEventListener(
    "click",
    () => {
      window.location.reload();
    }
  );

  newTransferButton?.addEventListener(
    "click",
    startNewTransfer
  );

  let entryEventsReady = false;

  window.setTimeout(() => {
    entryEventsReady =
      true;
  }, 0);

  const onEntryChanged = () => {
    if (!entryEventsReady) {
      return;
    }

    resetQuoteStageUi();

    if (typeof handleEntryChanged === "function") {
      handleEntryChanged();
    }

    setEntryButtonsForQuoteIdle({
      hasFiatContext:
        typeof hasFiatContext === "function"
          ? hasFiatContext()
          : true
    });
  };

  [
    "sourceCountry",
    "receiverCountry"
  ].forEach((id) => {
    getEl(id)?.addEventListener(
      "change",
      onEntryChanged
    );
  });

  getEl("amount")?.addEventListener(
    "input",
    onEntryChanged
  );
}
