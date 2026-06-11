// unibrij/unibridge-landing/surface/app.js

import {
  applyAmountLimitUi
} from "./amount-limits.js";

import {
  getRouteSelectedProvider,
  getFundingSelectedProvider
} from "./funding-context.js";

import {
  buildKycPayload as buildGenericKycPayload
} from "./kyc-payload.js";

import {
  renderExecutionQuote
} from "./ui-helpers.js";

import {
  createCoinsPhPicker
} from "./coinsph-picker.js";

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
let currentFundingProvider = null;

let processing = false;
let nextActionProcessing = false;

let currentRouteQuote = null;
let paymentStarted = false;

let coinsPhPicker = null;

const STORAGE_KEY = "ub_settlement";

/* =========================
   UI
========================= */

const sendBtn = document.getElementById("sendBtn");
const continueBtn = document.getElementById("continueBtn");
const coinsPhContinueBtn = document.getElementById("coinsPhContinueBtn");
const signBtn = document.getElementById("signBtn");
const statusBox = document.getElementById("status");

if (signBtn) {
  signBtn.disabled = true;
  signBtn.style.display = "none";
}

if (coinsPhContinueBtn) {
  coinsPhContinueBtn.disabled = true;
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
    const value = url.searchParams.get("session_id");

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

function cleanupFundingReturnUrl() {
  try {
    const url = new URL(window.location.href);

    url.searchParams.delete("session_id");
    url.searchParams.delete("settlement_id");
    url.searchParams.delete("return");

    window.history.replaceState(
      {},
      document.title,
      url.toString()
    );
  } catch {
    // no-op
  }
}

/* =========================
   BASIC HELPERS
========================= */

function getDestinationCountryCode() {
  return String(getValue("country")?.value || "")
    .toUpperCase()
    .trim();
}

function isPhilippinesDestination() {
  return getDestinationCountryCode() === "PH";
}

function isBrazilDestination() {
  return getDestinationCountryCode() === "BR";
}

function getActiveContinueButton() {
  return isPhilippinesDestination()
    ? coinsPhContinueBtn
    : continueBtn;
}

function setContinueButtonsDisabled(disabled) {
  if (continueBtn) {
    continueBtn.disabled = Boolean(disabled);
  }

  if (coinsPhContinueBtn) {
    coinsPhContinueBtn.disabled = Boolean(disabled);
  }
}

function setContinueButtonMode(mode) {
  const label =
    mode === "prepare_payment"
      ? "Prepare payment"
      : mode === "open_payment"
        ? "Continue to payment"
        : "Continue";

  if (continueBtn) {
    continueBtn.innerText = label;
  }

  if (coinsPhContinueBtn) {
    coinsPhContinueBtn.innerText = label;
  }
}

function resetUiToStart() {
  window.resetUiToStart?.();
}

function getCountryLabel() {
  const receiver =
    getDestinationCountryCode();

  if (receiver === "BR") {
    return "Brazil";
  }

  if (receiver === "PH") {
    return "Philippines";
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

function setCurrentFundingProvider(value) {
  if (!value) {
    return;
  }

  currentFundingProvider = value;
}

function refreshAmountLimitUi() {
  const activeContinueBtn =
    getActiveContinueButton() || continueBtn;

  const result =
    applyAmountLimitUi({
      amountInput:
        getValue("amount"),

      messageEl:
        document.getElementById("amountLimitHint"),

      continueBtn:
        activeContinueBtn,

      provider:
        currentFundingProvider,

      country:
        getSourceCountryCode()
    });

  /*
  --------------------------------------------------
  Quote button guard

  Before quote, provider may be null. amount-limits.js
  falls back to source-country limits, so controlled
  corridors such as AE are blocked visually before
  any route/provider is known.
  --------------------------------------------------
  */

  if (sendBtn && !settlementId) {
    sendBtn.disabled = !result.ok;
  }

  return result;
}

function setAmountInputDisabled(disabled) {
  const amountInput =
    getValue("amount");

  if (amountInput) {
    amountInput.disabled = Boolean(disabled);
  }
}

function resetQuoteState() {
  currentRouteQuote = null;
  currentFundingProvider = null;

  coinsPhPicker?.reset();
}

function resetFlowForRouteInputChange() {
  clearState();
  resetUiToStart();
  resetStatusMemory();
  setStatus("");

  const limitCheck =
    refreshAmountLimitUi();

  if (sendBtn) {
    sendBtn.disabled = !limitCheck.ok;
  }

  setContinueButtonsDisabled(true);
}

/* =========================
   DESTINATION PAYLOAD
========================= */

function buildBrazilDestinationPayload() {
  const pix =
    getValue("pix")?.value.trim();

  const taxIdEl =
    getValue("taxId");

  const taxId =
    taxIdEl
      ? taxIdEl.value.trim()
      : "";

  if (!pix) {
    throw new Error("PIX_required");
  }

  return taxId
    ? {
        pix,
        tax_id:
          taxId
      }
    : {
        pix
      };
}

function buildDestinationPayload() {
  if (isPhilippinesDestination()) {
    if (!coinsPhPicker) {
      throw new Error("COINSPH_PICKER_NOT_READY");
    }

    return coinsPhPicker.buildDestination();
  }

  if (isBrazilDestination()) {
    return buildBrazilDestinationPayload();
  }

  throw new Error("unsupported_destination_country");
}

/* =========================
   STORAGE
========================= */

function persistState(extra = {}) {
  const id =
    extra.id || settlementId;

  if (!id) return;

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      id,
      ts:
        Date.now(),

      payment_started:
        extra.payment_started ??
        paymentStarted ??
        false
    })
  );
}

function persistSettlement(id) {
  if (!id) return;

  settlementId = id;

  persistState({
    id,
    payment_started:
      false
  });
}

function markPaymentStarted() {
  paymentStarted = true;

  persistState({
    payment_started:
      true
  });
}

function getPersistedSettlement() {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY);

    if (!raw) return null;

    const data =
      JSON.parse(raw);

    if (!data?.id) {
      return null;
    }

    if (Date.now() - data.ts > 30 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return {
      id:
        data.id,

      payment_started:
        Boolean(data.payment_started)
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
  currentFundingProvider = null;

  processing = false;
  nextActionProcessing = false;

  currentRouteQuote = null;
  paymentStarted = false;

  localStorage.removeItem(STORAGE_KEY);

  resetQuoteState();
  setAmountInputDisabled(false);

  if (signBtn) {
    signBtn.disabled = true;
  }

  setContinueButtonsDisabled(true);

  if (sendBtn) {
    sendBtn.disabled = false;
  }

  setContinueButtonMode("prepare_payment");
}

/* =========================
   KYC
========================= */

function buildKycPayload() {
  return buildGenericKycPayload({
    telegramUser:
      tg?.initDataUnsafe?.user,

    sourceCountry:
      getSourceCountryCode()
  });
}

/* =========================
   STATUS / REFRESH
========================= */

async function refreshSettlementState() {
  if (!settlementId) return null;

  const status =
    await apiGet("settlement/status", {
      settlement_id:
        settlementId
    });

  setCurrentFundingProvider(
    getFundingSelectedProvider(status)
  );

  handleSettlementStatus({
    status,
    signBtn,

    continueBtn:
      getActiveContinueButton() ||
      continueBtn,

    emit,
    setStatus,
    clearState
  });

  return status;
}

/* =========================
   COINSPH PICKER INIT
========================= */

coinsPhPicker =
  createCoinsPhPicker({
    apiGet,

    isPhilippinesDestination,

    setContinueDisabled(value) {
      if (coinsPhContinueBtn) {
        coinsPhContinueBtn.disabled = Boolean(value);
      }
    }
  });

coinsPhPicker.bindEvents();

/* =========================
   START
========================= */

async function startFlow() {
  if (processing) return;

  try {
    clearState();
    resetUiToStart();
    resetStatusMemory();

    processing = true;

    if (sendBtn) {
      sendBtn.disabled = true;
    }

    setContinueButtonsDisabled(true);

    if (signBtn) {
      signBtn.disabled = true;
    }

    setStatus("Registering...");

    const amount =
      Number(getValue("amount")?.value);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("invalid_amount");
    }

    const limitCheck =
      refreshAmountLimitUi();

    if (limitCheck && !limitCheck.ok) {
      throw new Error(limitCheck.message);
    }

    const reg =
      await apiPost("session/register", {
        source_country:
          getValue("source_country")?.value,

        receiver_country:
          getValue("country")?.value
      });

    sessionId =
      reg.session_id;

    await apiPost("session/resolve", {
      session_id:
        sessionId
    });

    const quote =
      await apiPost("session/quote", {
        session_id:
          sessionId,

        amount
      });

    if (!quote.routes?.length) {
      throw new Error("no_routes");
    }

    const selectedRoute =
      quote.routes[0];

    routeId =
      selectedRoute.route_id ||
      selectedRoute.id;

    setCurrentFundingProvider(
      getRouteSelectedProvider(selectedRoute)
    );

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
        currentRouteQuote.executor_fee,

      setStatus
    });

    emit("unibridge:quote");

    setContinueButtonMode("prepare_payment");
    refreshAmountLimitUi();

    if (isPhilippinesDestination()) {
      await coinsPhPicker.load();
      coinsPhPicker.updateContinueState();

      setStatus(
        "Enter recipient name and GCash mobile number."
      );

      return;
    }

    if (continueBtn) {
      continueBtn.disabled = false;
    }

    setStatus("Enter PIX key");
  } catch (e) {
    setStatus(e, "error");

    const limitCheck =
      refreshAmountLimitUi();

    const activeBtn =
      getActiveContinueButton();

    if (activeBtn && (!limitCheck || limitCheck.ok)) {
      if (isPhilippinesDestination()) {
        coinsPhPicker?.updateContinueState();
      } else {
        activeBtn.disabled = false;
      }
    }
  } finally {
    processing = false;

    refreshAmountLimitUi();

    if (isPhilippinesDestination()) {
      coinsPhPicker?.updateContinueState();
    }
  }
}

/* =========================
   CONTINUE
========================= */

async function continueFlow() {
  if (processing) return;

  const activeContinueBtn =
    getActiveContinueButton() || continueBtn;

  try {
    const limitCheck =
      refreshAmountLimitUi();

    if (limitCheck && !limitCheck.ok) {
      throw new Error(limitCheck.message);
    }

    if (pendingWidgetUrl) {
      markPaymentStarted();
      setAmountInputDisabled(true);
      window.location.href = pendingWidgetUrl;
      return;
    }

    processing = true;

    if (activeContinueBtn) {
      activeContinueBtn.disabled = true;
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
        buildDestinationPayload();

      const redirect_url =
        buildFundingReturnUrl(sessionId);

      if (!redirect_url) {
        throw new Error("missing_redirect_url");
      }

      const create =
        await apiPost("settlement/create", {
          session_id:
            sessionId,

          route_id:
            routeId,

          destination,
          redirect_url
        });

      setCurrentFundingProvider(
        getFundingSelectedProvider(create)
      );

      persistSettlement(
        create.settlement_id
      );
    }

    const latestStatus =
      await refreshSettlementState();

    if (
      isPostFundingSettlementStatus(
        latestStatus?.status
      )
    ) {
      return;
    }

    if (!currentNextAction && !pendingWidgetUrl) {
      const funding =
        await apiPost("funding/session", {
          settlement_id:
            settlementId
        });

      setCurrentFundingProvider(
        getFundingSelectedProvider(funding)
      );

      currentNextAction =
        normalizeNextAction(
          funding?.next_action
        );

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

      pendingWidgetUrl =
        redirectUrl;

      emit("unibridge:quote");
      emit("unibridge:payment");

      markPaymentStarted();
      setAmountInputDisabled(true);

      window.location.href =
        redirectUrl;

      return;
    }

    if (action?.type === "await_confirmation") {
      emit("unibridge:quote");
      emit("unibridge:payment");

      setStatus(
        action.label ||
        "Waiting for payment confirmation..."
      );

      if (activeContinueBtn) {
        activeContinueBtn.disabled = false;
      }

      return;
    }

    if (action?.type === "step") {
      await window.UnibridgeRampFlow.processStepNextActions({
        emit,
        buildKycPayload,
        setStatus,

        setContinueDisabled(value) {
          if (activeContinueBtn) {
            activeContinueBtn.disabled = value;
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

      markPaymentStarted();
      setAmountInputDisabled(true);

      window.location.href =
        pendingWidgetUrl;

      return;
    }

    throw new Error("no_funding_flow");
  } catch (e) {
    setStatus(e, "error");

    const limitCheck =
      refreshAmountLimitUi();

    if (activeContinueBtn && (!limitCheck || limitCheck.ok)) {
      if (isPhilippinesDestination()) {
        coinsPhPicker?.updateContinueState();
      } else {
        activeContinueBtn.disabled = false;
      }
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
    const status =
      await apiGet("settlement/status", {
        settlement_id:
          settlementId
      });

    setCurrentFundingProvider(
      getFundingSelectedProvider(status)
    );

    const activeContinueBtn =
      getActiveContinueButton() || continueBtn;

    if (status?.status === "waiting_ramp_payment") {
      /*
      --------------------------------------------------
      Waiting ramp payment is not resumed on Surface.

      If the user is back here, treat the previous ramp
      session as abandoned / unpaid and allow a fresh flow.
      Successful payments are handled by backend provider
      webhooks / watchers, not by Surface return.
      --------------------------------------------------
      */

      clearState();
      resetUiToStart();
      resetStatusMemory();
      setStatus("");
      refreshAmountLimitUi();

      return;
    }

    setAmountInputDisabled(true);

    emit("unibridge:quote");

    handleSettlementStatus({
      status,
      signBtn,

      continueBtn:
        activeContinueBtn,

      emit,
      setStatus,
      clearState
    });
  } catch (e) {
    setStatus(e, "error");
  }
}

/* =========================
   LOAD / RESUME
========================= */

window.addEventListener("load", async () => {
  const sessionIdFromUrl =
    getSessionIdFromUrl();

  const fundingReturn =
    isFundingReturn();

  /*
  --------------------------------------------------
  Ramp return means the user came back without a
  completed payment. Successful payment completion is
  handled by backend provider webhooks / watchers, not
  by returning to the Surface page.
  --------------------------------------------------
  */

  if (sessionIdFromUrl && fundingReturn) {
    cleanupFundingReturnUrl();

    clearState();
    resetUiToStart();
    resetStatusMemory();
    setStatus("");
    refreshAmountLimitUi();

    return;
  }

  if (sessionIdFromUrl) {
    sessionId =
      sessionIdFromUrl;
  }

  const saved =
    getPersistedSettlement();

  if (!saved) {
    clearState();
    resetUiToStart();
    refreshAmountLimitUi();
    return;
  }

  settlementId =
    saved.id;

  paymentStarted =
    Boolean(saved.payment_started);

  if (!paymentStarted) {
    clearState();
    resetUiToStart();
    refreshAmountLimitUi();
    return;
  }

  await resumeFlowFromState();
});

window.addEventListener("focus", async () => {
  if (!settlementId || !paymentStarted) return;
  await resumeFlowFromState();
});

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible") return;
  if (!settlementId || !paymentStarted) return;

  await resumeFlowFromState();
});

/* =========================
   FIELD EVENTS
========================= */

const amountInput =
  getValue("amount");

const sourceCountryInput =
  getValue("source_country");

const countryInput =
  getValue("country");

if (amountInput) {
  amountInput.addEventListener("input", () => {
    if (
      sessionId ||
      routeId ||
      settlementId ||
      currentRouteQuote
    ) {
      resetFlowForRouteInputChange();
      return;
    }

    refreshAmountLimitUi();
  });

  amountInput.addEventListener("blur", () => {
    refreshAmountLimitUi();
  });
}

if (sourceCountryInput) {
  sourceCountryInput.addEventListener("change", () => {
    resetFlowForRouteInputChange();
  });
}

if (countryInput) {
  countryInput.addEventListener("change", () => {
    resetFlowForRouteInputChange();
  });
}

/* =========================
   BUTTON EVENTS
========================= */

if (sendBtn) {
  sendBtn.onclick = startFlow;
}

if (continueBtn) {
  continueBtn.onclick = continueFlow;
}

if (coinsPhContinueBtn) {
  coinsPhContinueBtn.onclick = continueFlow;
}
