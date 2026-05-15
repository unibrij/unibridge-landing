// unibrij/unibridge-landing/surface/public/app.js

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

let coinsPhChannelOptions = [];
let coinsPhChannelsLoaded = false;
let coinsPhChannelsLoading = false;

const STORAGE_KEY = "ub_settlement";

/* =========================
   UI
========================= */

const sendBtn = document.getElementById("sendBtn");
const continueBtn = document.getElementById("continueBtn");
const coinsPhContinueBtn = document.getElementById("coinsPhContinueBtn");
const signBtn = document.getElementById("signBtn");
const statusBox = document.getElementById("status");

const coinsPhBankSelect = document.getElementById("coinsPhBank");
const coinsPhRecipientFields = document.getElementById("coinsPhRecipientFields");
const coinsPhRecipientNameInput = document.getElementById("coinsPhRecipientName");
const coinsPhRecipientAccountInput = document.getElementById("coinsPhRecipientAccount");
const coinsPhRecipientAddressInput = document.getElementById("coinsPhRecipientAddress");
const coinsPhRemarksInput = document.getElementById("coinsPhRemarks");
const coinsPhHint = document.getElementById("coinsPhHint");

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

function resetQuoteState() {
  currentRouteQuote = null;
  currentFundingProvider = null;
  resetCoinsPhState();
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

function setContinueButtonsDisabled(disabled) {
  if (continueBtn) {
    continueBtn.disabled = Boolean(disabled);
  }

  if (coinsPhContinueBtn) {
    coinsPhContinueBtn.disabled = Boolean(disabled);
  }
}

function getActiveContinueButton() {
  return isPhilippinesDestination()
    ? coinsPhContinueBtn
    : continueBtn;
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

  const result = applyAmountLimitUi({
    amountInput: getValue("amount"),
    messageEl: document.getElementById("amountLimitHint"),
    continueBtn: activeContinueBtn,
    provider: currentFundingProvider,
    country: getSourceCountryCode()
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
  const amountInput = getValue("amount");
  if (amountInput) {
    amountInput.disabled = Boolean(disabled);
  }
}

function resetFlowForRouteInputChange() {
  clearState();
  resetUiToStart();
  resetStatusMemory();
  setStatus("");

  const limitCheck = refreshAmountLimitUi();

  if (sendBtn) {
    sendBtn.disabled = !limitCheck.ok;
  }

  setContinueButtonsDisabled(true);
}

/* =========================
   COINSPH / PHILIPPINES HELPERS
========================= */

function resetCoinsPhState() {
  coinsPhChannelOptions = [];
  coinsPhChannelsLoaded = false;
  coinsPhChannelsLoading = false;

  if (coinsPhBankSelect) {
    coinsPhBankSelect.innerHTML =
      '<option value="">Select payout institution</option>';
    coinsPhBankSelect.disabled = false;
  }

  if (coinsPhRecipientFields) {
    coinsPhRecipientFields.style.display = "none";
  }

  if (coinsPhRecipientNameInput) {
    coinsPhRecipientNameInput.value = "";
  }

  if (coinsPhRecipientAccountInput) {
    coinsPhRecipientAccountInput.value = "";
  }

  if (coinsPhRecipientAddressInput) {
    coinsPhRecipientAddressInput.value = "";
  }

  if (coinsPhRemarksInput) {
    coinsPhRemarksInput.value = "";
  }

  if (coinsPhHint) {
    coinsPhHint.innerText =
      "Select a payout institution, then enter the recipient details required for the Philippines payout.";
  }

  if (coinsPhContinueBtn) {
    coinsPhContinueBtn.disabled = true;
  }
}

function normalizeDigits(value) {
  return String(value || "")
    .replace(/[^\d]/g, "")
    .trim();
}

function normalizeOptionalText(value) {
  const normalized =
    String(value || "").trim();

  return normalized || null;
}

function getSelectedCoinsPhChannelOption() {
  if (!coinsPhBankSelect) {
    return null;
  }

  const index =
    Number(coinsPhBankSelect.value);

  if (!Number.isInteger(index) || index < 0) {
    return null;
  }

  return coinsPhChannelOptions[index] || null;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderCoinsPhBankOptions(options = []) {
  coinsPhChannelOptions =
    Array.isArray(options)
      ? options
      : [];

  if (!coinsPhBankSelect) {
    return;
  }

  if (!coinsPhChannelOptions.length) {
    coinsPhBankSelect.innerHTML =
      '<option value="">No payout institutions available</option>';
    coinsPhBankSelect.disabled = true;
    return;
  }

  const optionHtml =
    coinsPhChannelOptions
      .map((option, index) => {
        const label =
          escapeHtml(
            option.label ||
              option.bankName ||
              option.channelSubject ||
              ""
          );

        const channel =
          escapeHtml(
            option.channelName || ""
          );

        return `<option value="${index}">${label}${channel ? ` — ${channel}` : ""}</option>`;
      })
      .join("");

  coinsPhBankSelect.innerHTML =
    `<option value="">Select payout institution</option>${optionHtml}`;

  coinsPhBankSelect.disabled = false;
}

async function loadCoinsPhPayoutChannels() {
  if (!isPhilippinesDestination()) {
    return;
  }

  if (!coinsPhBankSelect) {
    return;
  }

  /*
  --------------------------------------------------
  Important:
  Do not pass amount here.

  The final PHP payout amount may depend on the ramp
  fill / USDC amount actually sold into the route.
  So the Surface loads general supported PH payout
  institutions and leaves amount validation to the
  provider/execution stage.
  --------------------------------------------------
  */

  if (
    coinsPhChannelsLoaded &&
    coinsPhChannelOptions.length
  ) {
    updateCoinsPhContinueState();
    return;
  }

  coinsPhChannelsLoading = true;

  coinsPhBankSelect.disabled = true;
  coinsPhBankSelect.innerHTML =
    '<option value="">Loading payout institutions...</option>';

  if (coinsPhRecipientFields) {
    coinsPhRecipientFields.style.display = "none";
  }

  if (coinsPhContinueBtn) {
    coinsPhContinueBtn.disabled = true;
  }

  if (coinsPhHint) {
    coinsPhHint.innerText =
      "Loading Philippines payout institutions...";
  }

  try {
    const response =
      await apiGet(
        "surface/options/coinsph/ph-payout-channels",
        {}
      );

    if (!response?.ok) {
      throw new Error(
        response?.error ||
        "COINSPH_CHANNELS_LOAD_FAILED"
      );
    }

    renderCoinsPhBankOptions(response.options || []);

    coinsPhChannelsLoaded =
      true;

    if (coinsPhHint) {
      coinsPhHint.innerText =
        response.count
          ? "Select a payout institution, then enter recipient details."
          : "No payout institutions are currently available.";
    }

    updateCoinsPhContinueState();
  } catch (err) {
    coinsPhChannelOptions = [];
    coinsPhChannelsLoaded = false;

    coinsPhBankSelect.innerHTML =
      '<option value="">Could not load payout institutions</option>';
    coinsPhBankSelect.disabled = true;

    if (coinsPhHint) {
      coinsPhHint.innerText =
        "Could not load Philippines payout institutions. Please try again.";
    }

    throw err;
  } finally {
    coinsPhChannelsLoading = false;
  }
}

function updateCoinsPhRecipientFieldsVisibility() {
  if (!coinsPhRecipientFields) {
    return;
  }

  const selected =
    getSelectedCoinsPhChannelOption();

  coinsPhRecipientFields.style.display =
    selected
      ? "block"
      : "none";
}

function validateCoinsPhDestinationInput() {
  const selected =
    getSelectedCoinsPhChannelOption();

  if (!selected) {
    return {
      ok: false,
      error: "COINSPH_BANK_REQUIRED"
    };
  }

  const recipientName =
    normalizeOptionalText(
      coinsPhRecipientNameInput?.value
    );

  const recipientAccountNumber =
    normalizeDigits(
      coinsPhRecipientAccountInput?.value
    );

  const recipientAddress =
    normalizeOptionalText(
      coinsPhRecipientAddressInput?.value
    );

  const remarks =
    normalizeOptionalText(
      coinsPhRemarksInput?.value
    );

  if (!recipientName) {
    return {
      ok: false,
      error: "COINSPH_RECIPIENT_NAME_REQUIRED"
    };
  }

  if (recipientName.length < 2) {
    return {
      ok: false,
      error: "COINSPH_RECIPIENT_NAME_TOO_SHORT"
    };
  }

  if (recipientName.length > 80) {
    return {
      ok: false,
      error: "COINSPH_RECIPIENT_NAME_TOO_LONG"
    };
  }

  if (!recipientAccountNumber) {
    return {
      ok: false,
      error: "COINSPH_RECIPIENT_ACCOUNT_NUMBER_REQUIRED"
    };
  }

  if (recipientAccountNumber.length < 6) {
    return {
      ok: false,
      error: "COINSPH_RECIPIENT_ACCOUNT_NUMBER_TOO_SHORT"
    };
  }

  if (recipientAccountNumber.length > 30) {
    return {
      ok: false,
      error: "COINSPH_RECIPIENT_ACCOUNT_NUMBER_TOO_LONG"
    };
  }

  if (
    recipientAddress &&
    recipientAddress.length > 160
  ) {
    return {
      ok: false,
      error: "COINSPH_RECIPIENT_ADDRESS_TOO_LONG"
    };
  }

  if (
    remarks &&
    remarks.length > 120
  ) {
    return {
      ok: false,
      error: "COINSPH_REMARKS_TOO_LONG"
    };
  }

  return {
    ok: true,
    option: selected,
    recipientName,
    recipientAccountNumber,
    recipientAddress,
    remarks
  };
}

function updateCoinsPhContinueState() {
  updateCoinsPhRecipientFieldsVisibility();

  if (!coinsPhContinueBtn) {
    return;
  }

  if (!isPhilippinesDestination()) {
    coinsPhContinueBtn.disabled = true;
    return;
  }

  if (coinsPhChannelsLoading) {
    coinsPhContinueBtn.disabled = true;
    return;
  }

  const validation =
    validateCoinsPhDestinationInput();

  coinsPhContinueBtn.disabled =
    !validation.ok;
}

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
        tax_id: taxId
      }
    : {
        pix
      };
}

function buildPhilippinesDestinationPayload() {
  const validation =
    validateCoinsPhDestinationInput();

  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const {
    option,
    recipientName,
    recipientAccountNumber,
    recipientAddress,
    remarks
  } =
    validation;

  const channelName =
    option.channelName ||
    option.transactionChannel;

  const channelSubject =
    option.channelSubject ||
    option.transactionSubject;

  if (!channelName) {
    throw new Error("COINSPH_CHANNEL_NAME_MISSING");
  }

  if (!channelSubject) {
    throw new Error("COINSPH_CHANNEL_SUBJECT_MISSING");
  }

  const destination = {
    country:
      "PH",

    currency:
      "PHP",

    bankId:
      option.id || null,

    bankName:
      option.label || null,

    bankCode:
      channelSubject,

    channelName,
    channelSubject,

    transactionChannel:
      option.transactionChannel || channelName,

    transactionSubject:
      option.transactionSubject || channelSubject,

    name:
      recipientName,

    account:
      recipientAccountNumber
  };

  if (recipientAddress) {
    destination.recipientAddress =
      recipientAddress;
  }

  if (remarks) {
    destination.remarks =
      remarks;
  }

  return destination;
}

function buildDestinationPayload() {
  if (isPhilippinesDestination()) {
    return buildPhilippinesDestinationPayload();
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
  const id = extra.id || settlementId;

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
      localStorage.removeItem(STORAGE_KEY);
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
    telegramUser: tg?.initDataUnsafe?.user,
    sourceCountry: getSourceCountryCode()
  });
}

/* =========================
   STATUS / REFRESH
========================= */

async function refreshSettlementState() {
  if (!settlementId) return null;

  const status = await apiGet("settlement/status", {
    settlement_id: settlementId
  });

  setCurrentFundingProvider(
    getFundingSelectedProvider(status)
  );

  handleSettlementStatus({
    status,
    signBtn,
    continueBtn: getActiveContinueButton() || continueBtn,
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

    setCurrentFundingProvider(
      getFundingSelectedProvider(status)
    );

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

    const amount = Number(getValue("amount")?.value);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("invalid_amount");
    }

    const limitCheck = refreshAmountLimitUi();

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
      countryLabel: getCountryLabel(),
      executorFee: currentRouteQuote.executor_fee,
      setStatus
    });

    emit("unibridge:quote");

    setContinueButtonMode("prepare_payment");
    refreshAmountLimitUi();

    if (isPhilippinesDestination()) {
      await loadCoinsPhPayoutChannels();
      updateCoinsPhContinueState();
      setStatus("Select payout institution and enter recipient details.");
      return;
    }

    if (continueBtn) {
      continueBtn.disabled = false;
    }

    setStatus("Enter PIX key");
  } catch (e) {
    setStatus(e, "error");

    const limitCheck = refreshAmountLimitUi();

    const activeBtn =
      getActiveContinueButton();

    if (activeBtn && (!limitCheck || limitCheck.ok)) {
      if (isPhilippinesDestination()) {
        updateCoinsPhContinueState();
      } else {
        activeBtn.disabled = false;
      }
    }
  } finally {
    processing = false;

    refreshAmountLimitUi();

    if (isPhilippinesDestination()) {
      updateCoinsPhContinueState();
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
    const limitCheck = refreshAmountLimitUi();

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
      const sessionIdFromUrl = getSessionIdFromUrl();

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

      const redirect_url = buildFundingReturnUrl(sessionId);

      if (!redirect_url) {
        throw new Error("missing_redirect_url");
      }

      const create = await apiPost("settlement/create", {
        session_id: sessionId,
        route_id: routeId,
        destination,
        redirect_url
      });

      setCurrentFundingProvider(
        getFundingSelectedProvider(create)
      );

      persistSettlement(create.settlement_id);
    }

    const latestStatus = await refreshSettlementState();

    if (isPostFundingSettlementStatus(latestStatus?.status)) {
      return;
    }

    if (!currentNextAction && !pendingWidgetUrl) {
      const funding = await apiPost("funding/session", {
        settlement_id: settlementId
      });

      setCurrentFundingProvider(
        getFundingSelectedProvider(funding)
      );

      currentNextAction =
        normalizeNextAction(funding?.next_action);

      pendingWidgetUrl =
        extractWidgetUrlFromFunding(funding);
    }

    const action = normalizeNextAction(currentNextAction);

    if (action?.type === "redirect") {
      const redirectUrl = action.url || pendingWidgetUrl;

      if (!redirectUrl) {
        throw new Error("missing_redirect_url");
      }

      pendingWidgetUrl = redirectUrl;
      setContinueButtonMode("open_payment");

      emit("unibridge:quote");
      emit("unibridge:payment");

      setStatus("Payment prepared. Tap again to continue.");

      if (activeContinueBtn) {
        activeContinueBtn.disabled = false;
      }

      return;
    }

    if (action?.type === "await_confirmation") {
      emit("unibridge:quote");
      emit("unibridge:payment");
      setStatus(
        action.label || "Waiting for payment confirmation..."
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
      setContinueButtonMode("open_payment");
      setStatus("Payment prepared. Tap again to continue.");

      if (activeContinueBtn) {
        activeContinueBtn.disabled = false;
      }

      return;
    }

    throw new Error("no_funding_flow");
  } catch (e) {
    setStatus(e, "error");

    const limitCheck = refreshAmountLimitUi();

    if (activeContinueBtn && (!limitCheck || limitCheck.ok)) {
      if (isPhilippinesDestination()) {
        updateCoinsPhContinueState();
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
    const status = await apiGet("settlement/status", {
      settlement_id: settlementId
    });

    setCurrentFundingProvider(
      getFundingSelectedProvider(status)
    );

    const activeContinueBtn =
      getActiveContinueButton() || continueBtn;

    if (status?.status === "waiting_ramp_payment") {
      if (!paymentStarted) {
        clearState();
        resetUiToStart();
        setStatus("");
        refreshAmountLimitUi();
        return;
      }

      setAmountInputDisabled(true);

      emit("unibridge:quote");
      emit("unibridge:payment");

      const funding = await apiPost("funding/session", {
        settlement_id: settlementId
      });

      setCurrentFundingProvider(
        getFundingSelectedProvider(funding)
      );

      currentNextAction =
        normalizeNextAction(funding?.next_action);

      pendingWidgetUrl =
        extractWidgetUrlFromFunding(funding);

      setContinueButtonMode("open_payment");

      if (activeContinueBtn) {
        activeContinueBtn.disabled = false;
      }

      setStatus(
        "Payment not confirmed yet. Continue payment or wait for confirmation."
      );

      return;
    }

    setAmountInputDisabled(true);

    emit("unibridge:quote");

    handleSettlementStatus({
      status,
      signBtn,
      continueBtn: activeContinueBtn,
      emit,
      setStatus,
      clearState
    });
  } catch (e) {
    setStatus(e, "error");
  }
}

window.addEventListener("load", async () => {
  const sessionIdFromUrl = getSessionIdFromUrl();
  const fundingReturn = isFundingReturn();

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
    resetUiToStart();
    setStatus("Could not restore funding session.", "error");
    refreshAmountLimitUi();
    return;
  }

  const saved = getPersistedSettlement();

  if (!saved) {
    clearState();
    resetUiToStart();
    refreshAmountLimitUi();
    return;
  }

  settlementId = saved.id;
  paymentStarted = Boolean(saved.payment_started);

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

const amountInput = getValue("amount");
const sourceCountryInput = getValue("source_country");
const countryInput = getValue("country");

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

if (coinsPhBankSelect) {
  coinsPhBankSelect.addEventListener("change", () => {
    updateCoinsPhContinueState();
  });
}

[
  coinsPhRecipientNameInput,
  coinsPhRecipientAccountInput,
  coinsPhRecipientAddressInput,
  coinsPhRemarksInput
].forEach((input) => {
  input?.addEventListener("input", () => {
    updateCoinsPhContinueState();
  });

  input?.addEventListener("blur", () => {
    updateCoinsPhContinueState();
  });
});

/* =========================
   EVENTS
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
