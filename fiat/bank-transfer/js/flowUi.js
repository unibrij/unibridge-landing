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
  runBankTransferFlow
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
}
