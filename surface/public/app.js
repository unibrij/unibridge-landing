// unibrij/unibridge-landing/surface/public/app.js

import {
  applyAmountLimitUi
} from "./amount-limits.js";

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

if (signBtn) {
  signBtn.disabled = true;
  signBtn.style.display = "none";
}

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
  extractWidgetUrlFromFunding
} = window.UnibridgeNextAction;
const {
  isPostFundingSettlementStatus
} = window.UnibridgeSettlementViewState;

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
   RETURN URL HELPERS
========================= */

function buildFundingReturnUrl(targetSessionId) {
  if (!targetSessionId) {
    return null;
  }

  try {
    const url = new URL(window.location.href);

    /*
    --------------------------------------------------
    Build a funding return URL from a value already
    known before settlement/create: session_id.

    Important:
    - remove stale settlement_id from prior runs
    - keep the user on the same surface route
    --------------------------------------------------
    */

    url.searchParams.delete("settlement_id");

    url.searchParams.set("session_id", targetSessionId);
    url.searchParams.set("return", "funding");

    return url.toString();
  } catch {
    return null;
  }
}

function getSessionIdFromUrl() {
  try {
    const url = new URL(window.location.href);
    const value =
      url.searchParams.get("session_id");

    return value && value.trim()
      ? value.trim()
      : null;
  } catch {
    return null;
  }
}

function isFundingReturn() {
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get("return") === "funding";
  } catch {
    return false;
  }
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

  setDisplayIfPresent("executorFeeRow", "none");
}

function renderExecutionQuote({
  requestedAmount,
  countryLabel,
  executorFee
}) {
  setTextIfPresent("sumAmount", formatNumber(requestedAmount));
  setTextIfPresent("sumCountry", countryLabel || "Brazil");

  const normalizedExecutorFee =
    Number(executorFee ?? 0);

  if (Number.isFinite(normalizedExecutorFee)) {
    setTextIfPresent(
      "sumExecutorFee",
      formatNumber(normalizedExecutorFee)
    );
    setDisplayIfPresent("executorFeeRow", "block");
  } else {
    setDisplayIfPresent("executorFeeRow", "none");
  }

  const executorFeeRow =
    document.getElementById("executorFeeRow");

  if (!executorFeeRow) {
    const parts = [
      `Amount: ${formatNumber(requestedAmount)}`
    ];

    if (Number.isFinite(normalizedExecutorFee)) {
      parts.push(
        `Execution fee: ${formatNumber(normalizedExecutorFee)}`
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

  if (receiver === "GB" || receiver === "UK") {
    return "United Kingdom";
  }

  return receiver || "Brazil";
}

function getSourceCountryCode() {
  const direct =
    String(getValue("source_country")?.value || "")
      .toUpperCase()
      .trim();

  if (direct) {
    return direct;
  }

  const fallback =
    String(getValue("country")?.value || "")
      .toUpperCase()
      .trim();

  return fallback || "BR";
}

function getSelectedRampProvider() {
  const sourceCountry =
    getSourceCountryCode();

  if (sourceCountry === "GB" || sourceCountry === "UK") {
    return "onramp";
  }

  if (sourceCountry === "US" || sourceCountry === "USA") {
    return "transak";
  }

  return "guardarian";
}

function refreshAmountLimitUi() {
  return applyAmountLimitUi({
    amountInput: getValue("amount"),
    messageEl: document.getElementById("amountLimitHint"),
    continueBtn,
    provider: getSelectedRampProvider(),
    country: getSourceCountryCode()
  });
}

function setAmountInputDisabled(disabled) {
  const amountInput = getValue("amount");
  if (amountInput) {
    amountInput.disabled = Boolean(disabled);
  }
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
  setAmountInputDisabled(false);

  if (signBtn) {
    signBtn.disabled = true;
  }

  if (continueBtn) {
    continueBtn.disabled = true;
  }

  setContinueButtonMode("prepare_payment");
}

/* =========================
   KYC
========================= */

function buildKycPayload() {
  const tgUser = tg?.initDataUnsafe?.user;
  const sourceCountry = getSourceCountryCode();

  if (sourceCountry === "GB" || sourceCountry === "UK") {
    return {
      firstName: tgUser?.first_name || "Test",
      lastName: tgUser?.last_name || "User",
      mobileNumber: "+447700900123",
      dob: "1990-01-01",
      addressLine1: "221B Baker Street",
      city: "London",
      state: "England",
      postCode: "NW1 6XE",
      countryCode: "GB"
    };
  }

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

async function tryRecoverSettlementBySessionId(targetSessionId) {
  if (!targetSessionId) {
    return null;
  }

  try {
    const status = await apiGet("settlement/status", {
      session_id: targetSessionId
    });

    const recoveredSettlementId =
      status?.settlement_id &&
      typeof status.settlement_id === "string"
        ? status.settlement_id.trim()
        : null;

    if (!recoveredSettlementId) {
      return null;
    }

    settlementId = recoveredSettlementId;
    persistSettlement(recoveredSettlementId);

    return recoveredSettlementId;
  } catch {
    return null;
  }
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

    if (sendBtn) {
      sendBtn.disabled = true;
    }

    if (continueBtn) {
      continueBtn.disabled = true;
    }

    if (signBtn) {
      signBtn.disabled = true;
    }

    setStatus("Registering...");

    const amount = Number(getValue("amount")?.value);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("invalid_amount");
    }

    const limitCheck =
      refreshAmountLimitUi();

    if (limitCheck && !limitCheck.ok) {
      throw new Error(limitCheck.message);
    }

    const reg = await apiPost("session/register", {
      source_country: getValue("source_country")?.value,
      receiver_country: getValue("country")?.value
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
        selectedRoute.executor_fee ?? 0
    };

    renderExecutionQuote({
      requestedAmount:
        currentRouteQuote.requested_amount,
      countryLabel:
        getCountryLabel(),
      executorFee:
        currentRouteQuote.executor_fee
    });

    emit("unibridge:quote");

    setAmountInputDisabled(true);

    if (continueBtn) {
      continueBtn.disabled = false;
    }

    setContinueButtonMode("prepare_payment");
    refreshAmountLimitUi();

    const executorFeeRow =
      document.getElementById("executorFeeRow");

    if (executorFeeRow) {
      setStatus("Enter PIX key");
    }
  } catch (e) {
    setStatus(e, "error");

    const limitCheck =
      refreshAmountLimitUi();

    if (continueBtn && (!limitCheck || limitCheck.ok)) {
      continueBtn.disabled = false;
    }
  } finally {
    processing = false;

    if (sendBtn) {
      sendBtn.disabled = false;
    }
  }
}

/* =========================
   CONTINUE
========================= */

async function continueFlow() {
  if (processing) return;

  try {
    const limitCheck =
      refreshAmountLimitUi();

    if (limitCheck && !limitCheck.ok) {
      throw new Error(limitCheck.message);
    }

    if (pendingWidgetUrl) {
      markPaymentStarted();
      window.location.href = pendingWidgetUrl;
      return;
    }

    processing = true;

    if (continueBtn) {
      continueBtn.disabled = true;
    }

    const pix = getValue("pix")?.value.trim();
    const taxIdEl = getValue("taxId");
    const taxId = taxIdEl ? taxIdEl.value.trim() : "";

    if (!pix) {
      throw new Error("PIX_required");
    }

    if (!sessionId) {
      const sessionIdFromUrl =
        getSessionIdFromUrl();

      if (sessionIdFromUrl) {
        sessionId = sessionIdFromUrl;
      }
    }

    if (!settlementId) {
      if (!sessionId || !routeId) {
        throw new Error("missing_session_or_route");
      }

      const destination =
        taxId
          ? { pix, tax_id: taxId }
          : { pix };

      const redirect_url =
        buildFundingReturnUrl(sessionId);

      if (!redirect_url) {
        throw new Error("missing_redirect_url");
      }

      const create = await apiPost("settlement/create", {
        session_id: sessionId,
        route_id: routeId,
        destination,
        redirect_url
      });

      persistSettlement(create.settlement_id);
    }

    const latestStatus =
      await refreshSettlementState();

    if (isPostFundingSettlementStatus(latestStatus?.status)) {
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

      if (continueBtn) {
        continueBtn.disabled = false;
      }

      return;
    }

    if (action?.type === "await_confirmation") {
      emit("unibridge:quote");
      emit("unibridge:payment");
      setStatus(
        action.label || "Waiting for payment confirmation..."
      );

      if (continueBtn) {
        continueBtn.disabled = false;
      }

      return;
    }

    if (action?.type === "step") {
      await window.UnibridgeRampFlow.processStepNextActions({
        emit,
        buildKycPayload,
        setStatus,
        setContinueDisabled(value) {
          if (continueBtn) {
            continueBtn.disabled = value;
          }
        },
        setContinueMode(mode) {
          setContinueButtonMode(mode);
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

      if (continueBtn) {
        continueBtn.disabled = false;
      }

      return;
    }

    throw new Error("no_funding_flow");
  } catch (e) {
    setStatus(e, "error");

    const limitCheck =
      refreshAmountLimitUi();

    if (continueBtn && (!limitCheck || limitCheck.ok)) {
      continueBtn.disabled = false;
    }
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
    setAmountInputDisabled(true);

    const status = await apiGet("settlement/status", {
      settlement_id: settlementId
    });

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

      if (continueBtn) {
        continueBtn.disabled = false;
      }

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
  const sessionIdFromUrl =
    getSessionIdFromUrl();

  const fundingReturn =
    isFundingReturn();

  if (sessionIdFromUrl) {
    sessionId = sessionIdFromUrl;
  }

  if (sessionIdFromUrl && fundingReturn) {
    paymentStarted = true;

    const recoveredSettlementId =
      await tryRecoverSettlementBySessionId(sessionIdFromUrl);

    if (recoveredSettlementId) {
      paymentStarted = true;
      persistState({
        id: recoveredSettlementId,
        payment_started: true
      });

      await resumeFlowFromState();
      return;
    }

    clearState();
    setStatus("Could not restore funding session.", "error");
    return;
  }

  const saved = getPersistedSettlement();
  if (!saved) {
    refreshAmountLimitUi();
    return;
  }

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
   FIELD EVENTS
========================= */

const amountInput = getValue("amount");
const sourceCountryInput = getValue("source_country");

if (amountInput) {
  amountInput.addEventListener("input", refreshAmountLimitUi);
  amountInput.addEventListener("blur", refreshAmountLimitUi);
}

if (sourceCountryInput) {
  sourceCountryInput.addEventListener("change", refreshAmountLimitUi);
}

/* =========================
   EVENTS
========================= */

if (sendBtn) {
  sendBtn.onclick = startFlow;
}

if (continueBtn) {
  continueBtn.onclick = continueFlow;
}
