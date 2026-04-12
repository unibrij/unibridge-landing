// unibrij/unibridge-landing/surface/public/app.js

const tg = window.Telegram?.WebApp;
if (tg) tg.expand();

/* =========================
   STATE
========================= */

let sessionId = null;
let routeId = null;
let settlementId = null;

let pendingWidgetUrl = null;
let currentNextAction = null;

let processing = false;
let nextActionProcessing = false;

let currentRouteQuote = null;
let paymentStarted = false;

const STORAGE_KEY = "ub_settlement";

/* =========================
   UI
========================= */

const sendBtn = document.getElementById("sendBtn");
const continueBtn = document.getElementById("continueBtn");
const signBtn = document.getElementById("signBtn");
const statusBox = document.getElementById("status");

signBtn.disabled = true;

/* =========================
   SHORTCUTS
========================= */

const { apiGet, apiPost } = window.UnibridgeApi;
const {
  resetStatusMemory,
  setStatus: setStatusInternal,
  handleSettlementStatus
} = window.UnibridgeStatus;
const {
  normalizeNextAction,
  extractWidgetUrlFromFunding,
  isTerminalOrAdvancedSettlementStatus
} = window.UnibridgeNextAction;

/* =========================
   EVENTS
========================= */

function emit(name) {
  window.dispatchEvent(new Event(name));
}

function setStatus(msg, type) {
  setStatusInternal(statusBox, msg, type);
}

function getValue(id) {
  return document.getElementById(id);
}

/* =========================
   HELPERS
========================= */

function formatNumber(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return "—";
  }

  if (Number.isInteger(n)) {
    return String(n);
  }

  return n.toFixed(2).replace(/\.00$/, "");
}

function setTextIfPresent(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.innerText = value;
  }
}

function setDisplayIfPresent(id, displayValue) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = displayValue;
  }
}

function resetQuoteState() {
  currentRouteQuote = null;

  setTextIfPresent("sumAmount", "");
  setTextIfPresent("sumCountry", "");
  setTextIfPresent("sumExecutorFee", "");
  setTextIfPresent("sumUniBridgeFee", "");

  setDisplayIfPresent("executorFeeRow", "none");
  setDisplayIfPresent("uniBridgeFeeRow", "none");
}

function renderExecutionQuote({
  requestedAmount,
  countryLabel,
  executorFee,
  unibridgeFee
}) {
  setTextIfPresent("sumAmount", formatNumber(requestedAmount));
  setTextIfPresent("sumCountry", countryLabel || "Brazil");

  const normalizedExecutorFee =
    Number(executorFee ?? 0);

  const normalizedUniBridgeFee =
    Number(unibridgeFee ?? 0);

  if (Number.isFinite(normalizedExecutorFee)) {
    setTextIfPresent(
      "sumExecutorFee",
      formatNumber(normalizedExecutorFee)
    );
    setDisplayIfPresent("executorFeeRow", "block");
  } else {
    setDisplayIfPresent("executorFeeRow", "none");
  }

  if (
    Number.isFinite(normalizedUniBridgeFee) &&
    normalizedUniBridgeFee > 0
  ) {
    setTextIfPresent(
      "sumUniBridgeFee",
      formatNumber(normalizedUniBridgeFee)
    );
    setDisplayIfPresent("uniBridgeFeeRow", "block");
  } else {
    setDisplayIfPresent("uniBridgeFeeRow", "none");
  }

  /*
  --------------------------------------------------
  Fallback textual summary for older HTML versions
  --------------------------------------------------
  */

  const executorFeeRow =
    document.getElementById("executorFeeRow");

  const uniBridgeFeeRow =
    document.getElementById("uniBridgeFeeRow");

  if (!executorFeeRow && !uniBridgeFeeRow) {
    const parts = [
      `Amount: ${formatNumber(requestedAmount)}`
    ];

    if (Number.isFinite(normalizedExecutorFee)) {
      parts.push(
        `Execution fee: ${formatNumber(normalizedExecutorFee)}`
      );
    }

    if (
      Number.isFinite(normalizedUniBridgeFee) &&
      normalizedUniBridgeFee > 0
    ) {
      parts.push(
        `UniBridge fee: ${formatNumber(normalizedUniBridgeFee)}`
      );
    }

    setStatus(parts.join("\n"));
  }
}

function setContinueButtonMode(mode) {
  if (!continueBtn) return;

  if (mode === "prepare_payment") {
    continueBtn.innerText = "Prepare payment";
    return;
  }

  if (mode === "open_payment") {
    continueBtn.innerText = "Continue to payment";
    return;
  }

  continueBtn.innerText = "Continue";
}

function getCountryLabel() {
  const receiver =
    String(getValue("country")?.value || "")
      .toUpperCase()
      .trim();

  if (receiver === "BR") {
    return "Brazil";
  }

  return receiver || "Brazil";
}

/* =========================
   STORAGE
========================= */

function persistState(extra = {}) {
  const id =
    extra.id ||
    settlementId;

  if (!id) return;

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      id,
      ts: Date.now(),
      payment_started:
        extra.payment_started ?? paymentStarted ?? false
    })
  );
}

function persistSettlement(id) {
  if (!id) return;

  settlementId = id;
  persistState({
    id,
    payment_started: false
  });
}

function markPaymentStarted() {
  paymentStarted = true;
  persistState({
    payment_started: true
  });
}

function getPersistedSettlement() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw);

    if (!data?.id) {
      return null;
    }

    if (Date.now() - data.ts > 30 * 60 * 1000) {
      clearState();
      return null;
    }

    return {
      id: data.id,
      payment_started: Boolean(data.payment_started)
    };
  } catch {
    return null;
  }
}

function clearState() {
  sessionId = null;
  routeId = null;
  settlementId = null;

  pendingWidgetUrl = null;
  currentNextAction = null;

  processing = false;
  nextActionProcessing = false;

  paymentStarted = false;

  localStorage.removeItem(STORAGE_KEY);

  resetQuoteState();

  signBtn.disabled = true;
  continueBtn.disabled = true;

  setContinueButtonMode("prepare_payment");
}

/* =========================
   KYC
========================= */

function buildKycPayload() {
  const tgUser = tg?.initDataUnsafe?.user;

  return {
    firstName: tgUser?.first_name || "Test",
    lastName: tgUser?.last_name || "User",
    mobileNumber: "+5511999999999",
    dob: "1990-01-01",
    addressLine1: "Rua Exemplo 123",
    city: "Curitiba",
    state: "PR",
    postCode: "80000-000",
    countryCode: "BR"
  };
}

/* =========================
   STATUS / REFRESH
========================= */

async function refreshSettlementState() {
  if (!settlementId) return null;

  const status = await apiGet("settlement/status", {
    settlement_id: settlementId
  });

  handleSettlementStatus({
    status,
    signBtn,
    continueBtn,
    emit,
    setStatus,
    clearState
  });

  return status;
}

/* =========================
   START
========================= */

async function startFlow() {
  if (processing) return;

  try {
    clearState();
    resetStatusMemory();

    processing = true;

    sendBtn.disabled = true;
    continueBtn.disabled = true;
    signBtn.disabled = true;

    setStatus("Registering...");

    const amount = Number(getValue("amount").value);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("invalid_amount");
    }

    const reg = await apiPost("session/register", {
      source_country: getValue("source_country").value,
      receiver_country: getValue("country").value
    });

    sessionId = reg.session_id;

    await apiPost("session/resolve", {
      session_id: sessionId
    });

    const quote = await apiPost("session/quote", {
      session_id: sessionId,
      amount
    });

    if (!quote.routes?.length) {
      throw new Error("no_routes");
    }

    const selectedRoute = quote.routes[0];
    routeId = selectedRoute.route_id || selectedRoute.id;

    currentRouteQuote = {
      requested_amount:
        quote.requested_amount ?? amount,
      payout_amount:
        selectedRoute.payout_amount ?? null,
      funding_amount:
        selectedRoute.funding_amount ?? null,
      executor_fee:
        selectedRoute.executor_fee ?? 0,
      unibridge_fee:
        selectedRoute.unibridge_fee ?? 0
    };

    renderExecutionQuote({
      requestedAmount:
        currentRouteQuote.requested_amount,
      countryLabel:
        getCountryLabel(),
      executorFee:
        currentRouteQuote.executor_fee,
      unibridgeFee:
        currentRouteQuote.unibridge_fee
    });

    emit("unibridge:quote");

    continueBtn.disabled = false;
    setContinueButtonMode("prepare_payment");

    /*
    --------------------------------------------------
    Avoid overwriting textual quote fallback if HTML
    summary rows are not present yet.
    --------------------------------------------------
    */

    const executorFeeRow =
      document.getElementById("executorFeeRow");
    const uniBridgeFeeRow =
      document.getElementById("uniBridgeFeeRow");

    if (executorFeeRow || uniBridgeFeeRow) {
      setStatus("Enter PIX key");
    }
  } catch (e) {
    setStatus(e, "error");
    continueBtn.disabled = false;
  } finally {
    processing = false;
    sendBtn.disabled = false;
  }
}

/* =========================
   CONTINUE
========================= */

async function continueFlow() {
  if (processing) return;

  try {
    /*
    --------------------------------------------------
    Second click after payment prep opens widget
    --------------------------------------------------
    */

    if (pendingWidgetUrl) {
      markPaymentStarted();
      window.location.href = pendingWidgetUrl;
      return;
    }

    processing = true;
    continueBtn.disabled = true;

    const pix = getValue("pix").value.trim();
    const taxIdEl = getValue("taxId");
    const taxId = taxIdEl ? taxIdEl.value.trim() : "";

    if (!pix) {
      throw new Error("PIX_required");
    }

    if (!settlementId) {
      if (!sessionId || !routeId) {
        throw new Error("missing_session_or_route");
      }

      const destination =
        taxId
          ? { pix, tax_id: taxId }
          : { pix };

      const create = await apiPost("settlement/create", {
        session_id: sessionId,
        route_id: routeId,
        destination
      });

      persistSettlement(create.settlement_id);
    }

    const latestStatus =
      await refreshSettlementState();

    if (isTerminalOrAdvancedSettlementStatus(latestStatus?.status)) {
      return;
    }

    if (!currentNextAction && !pendingWidgetUrl) {
      const funding = await apiPost("funding/session", {
        settlement_id: settlementId
      });

      currentNextAction =
        normalizeNextAction(funding?.next_action);

      pendingWidgetUrl =
        extractWidgetUrlFromFunding(funding);
    }

    const action =
      normalizeNextAction(currentNextAction);

    if (action?.type === "redirect") {
      const redirectUrl =
        action.url || pendingWidgetUrl;

      if (!redirectUrl) {
        throw new Error("missing_redirect_url");
      }

      pendingWidgetUrl = redirectUrl;
      setContinueButtonMode("open_payment");

      emit("unibridge:quote");
      emit("unibridge:payment");

      setStatus("Payment prepared. Tap again to continue.");
      continueBtn.disabled = false;
      return;
    }

    if (action?.type === "await_confirmation") {
      emit("unibridge:quote");
      emit("unibridge:payment");
      setStatus(
        action.label || "Waiting for payment confirmation..."
      );
      continueBtn.disabled = false;
      return;
    }

    if (action?.type === "step") {
      await window.UnibridgeRampFlow.processStepNextActions({
        emit,
        buildKycPayload,
        setStatus,
        setContinueDisabled(value) {
          continueBtn.disabled = value;
        },
        getSettlementId() {
          return settlementId;
        },
        getCurrentNextAction() {
          return currentNextAction;
        },
        setCurrentNextAction(value) {
          currentNextAction = value;
        },
        getPendingWidgetUrl() {
          return pendingWidgetUrl;
        },
        setPendingWidgetUrl(value) {
          pendingWidgetUrl = value || null;

          if (pendingWidgetUrl) {
            setContinueButtonMode("open_payment");
          }
        },
        getNextActionProcessing() {
          return nextActionProcessing;
        },
        setNextActionProcessing(value) {
          nextActionProcessing = value;
        }
      });
      return;
    }

    if (pendingWidgetUrl) {
      emit("unibridge:quote");
      emit("unibridge:payment");
      setContinueButtonMode("open_payment");
      setStatus("Payment prepared. Tap again to continue.");
      continueBtn.disabled = false;
      return;
    }

    throw new Error("no_funding_flow");
  } catch (e) {
    setStatus(e, "error");
    continueBtn.disabled = false;
  } finally {
    processing = false;
  }
}

/* =========================
   SIGN
========================= */

async function signAndSubmit() {
  if (processing) return;

  try {
    processing = true;
    signBtn.disabled = true;

    const status = await apiGet("settlement/status", {
      settlement_id: settlementId
    });

    if (status?.status !== "funding_confirmed") {
      throw new Error("not_ready_for_execution");
    }

    setStatus("Preparing transaction...");

    const unsignedTx = await apiPost("execution/build-unsigned-tx", {
      settlement_id: settlementId
    });

    const signer = window.UnibridgeSigner?.signSmartPayTx;

    if (!signer) {
      setStatus("Connect wallet", "error");
      signBtn.disabled = false;
      return;
    }

    const signedTx = await signer(unsignedTx);

    if (!signedTx || typeof signedTx !== "string") {
      throw new Error("invalid_signed_tx");
    }

    await apiPost("execution/submit-signed-tx", {
      settlement_id: settlementId,
      signed_tx: signedTx
    });

    currentNextAction = null;
    pendingWidgetUrl = null;
    signBtn.disabled = true;
    continueBtn.disabled = true;

    emit("unibridge:funding");
    setStatus("Submitted — tracking...");
  } catch (e) {
    setStatus(e, "error");
    signBtn.disabled = false;
  } finally {
    processing = false;
  }
}

/* =========================
   RESUME
========================= */

async function resumeFlowFromState() {
  if (!settlementId || processing) return;

  try {
    const status = await apiGet("settlement/status", {
      settlement_id: settlementId
    });

    /*
    --------------------------------------------------
    Distinguish between:
    1) settlement created but payment never started
    2) user already went into payment flow and came back
    --------------------------------------------------
    */

    if (status?.status === "waiting_ramp_payment") {
      if (!paymentStarted) {
        clearState();
        setStatus("");
        return;
      }

      emit("unibridge:quote");
      emit("unibridge:payment");

      const funding = await apiPost("funding/session", {
        settlement_id: settlementId
      });

      currentNextAction =
        normalizeNextAction(funding?.next_action);

      pendingWidgetUrl =
        extractWidgetUrlFromFunding(funding);

      setContinueButtonMode("open_payment");
      continueBtn.disabled = false;

      setStatus(
        "Payment not confirmed yet. Continue payment or wait for confirmation."
      );

      return;
    }

    emit("unibridge:quote");

    handleSettlementStatus({
      status,
      signBtn,
      continueBtn,
      emit,
      setStatus,
      clearState
    });
  } catch (e) {
    setStatus(e, "error");
  }
}

window.addEventListener("load", async () => {
  const saved = getPersistedSettlement();
  if (!saved) return;

  settlementId = saved.id;
  paymentStarted = Boolean(saved.payment_started);

  await resumeFlowFromState();
});

window.addEventListener("focus", async () => {
  if (!settlementId) return;
  await resumeFlowFromState();
});

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible") return;
  if (!settlementId) return;
  await resumeFlowFromState();
});

/* =========================
   EVENTS
========================= */

sendBtn.onclick = startFlow;
continueBtn.onclick = continueFlow;
signBtn.onclick = signAndSubmit;
