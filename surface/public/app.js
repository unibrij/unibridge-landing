// unibrij/unibridge-landing/surface/public/app.js

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.expand();
}

let sessionId = null;
let routeId = null;
let settlementId = null;
let poller = null;
let confirmingFunding = false;
let submittingExecution = false;
let currentRoute = null;
let paymentCheckStartedAt = null;
let pendingWidgetUrl = null;

const PAYMENT_STARTED_KEY = "ub_payment_started";
const PAYMENT_STARTED_AT_KEY = "ub_payment_started_at";
const SETTLEMENT_KEY = "ub_settlement";
const PAYMENT_RECONCILIATION_WINDOW_MS = 30_000;
const POLL_INTERVAL_MS = 5_000;

const sendBtn = document.getElementById("sendBtn");
const continueBtn = document.getElementById("continueBtn");
const signBtn = document.getElementById("signBtn");
const statusBox = document.getElementById("status");
const summaryBox = document.getElementById("summary");
const pixBox = document.getElementById("pixBox");
const taxBox = document.getElementById("taxBox");
const signBox = document.getElementById("signBox");

function setStep(n) {
  for (let i = 1; i <= 6; i++) {
    document.getElementById("step" + i).classList.remove("active");
  }

  const stepEl = document.getElementById("step" + n);
  if (stepEl) {
    stepEl.classList.add("active");
  }
}

function normalizeErrorMessage(msg) {
  if (typeof msg === "string") {
    return msg;
  }

  if (msg instanceof Error) {
    return msg.message || "Unexpected error";
  }

  if (msg && typeof msg === "object") {
    if (typeof msg.error === "string" && msg.error.trim()) {
      return msg.error;
    }

    if (typeof msg.message === "string" && msg.message.trim()) {
      return msg.message;
    }

    if (
      msg.error &&
      typeof msg.error === "object" &&
      typeof msg.error.message === "string" &&
      msg.error.message.trim()
    ) {
      return msg.error.message;
    }

    try {
      return JSON.stringify(msg);
    } catch {
      return "Unexpected error";
    }
  }

  return String(msg || "");
}

function setStatus(msg, type) {
  statusBox.innerText = normalizeErrorMessage(msg);
  statusBox.className = "";

  if (type === "success") {
    statusBox.classList.add("status-success");
  }

  if (type === "error") {
    statusBox.classList.add("status-error");
  }
}

function formatAmount(value, symbol = "") {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `${n.toFixed(2)} ${symbol}`.trim();
}

function persistSettlement(id) {
  if (!id) return;
  localStorage.setItem(SETTLEMENT_KEY, id);
}

function getPersistedSettlement() {
  return localStorage.getItem(SETTLEMENT_KEY);
}

function markPaymentStarted() {
  const now = Date.now();
  localStorage.setItem(PAYMENT_STARTED_KEY, "1");
  localStorage.setItem(PAYMENT_STARTED_AT_KEY, String(now));
  paymentCheckStartedAt = now;
}

function getPaymentStarted() {
  return localStorage.getItem(PAYMENT_STARTED_KEY) === "1";
}

function getPaymentStartedAt() {
  const raw = localStorage.getItem(PAYMENT_STARTED_AT_KEY);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function clearPaymentStarted() {
  localStorage.removeItem(PAYMENT_STARTED_KEY);
  localStorage.removeItem(PAYMENT_STARTED_AT_KEY);
  paymentCheckStartedAt = null;
}

function clearPersistedSettlement() {
  localStorage.removeItem(SETTLEMENT_KEY);
}

function clearLocalFlowState() {
  clearPersistedSettlement();
  clearPaymentStarted();
  settlementId = null;
  pendingWidgetUrl = null;
  resetProcessingFlags();
}

function resetProcessingFlags() {
  confirmingFunding = false;
  submittingExecution = false;
}

function showFundingForm() {
  pixBox.style.display = "block";
  signBox.style.display = "none";
}

function showSignBox() {
  pixBox.style.display = "none";
  signBox.style.display = "block";
}

function hideAllActionBoxes() {
  pixBox.style.display = "none";
  signBox.style.display = "none";
}

function updatePricingPreview(preview) {
  const row = document.getElementById("estimatedPaymentRow");
  const el = document.getElementById("sumEstimatedPayment");

  if (!row || !el) return;

  if (
    preview &&
    preview.fiat_amount !== undefined &&
    preview.fiat_amount !== null
  ) {
    el.innerText = formatAmount(
      preview.fiat_amount,
      preview.fiat_currency || ""
    );
    row.style.display = "block";
    return;
  }

  el.innerText = "";
  row.style.display = "none";
}

function resetToStartUI() {
  stopPolling();
  resetProcessingFlags();
  pendingWidgetUrl = null;
  hideAllActionBoxes();
  summaryBox.style.display = "none";
  taxBox.style.display = "none";
  sendBtn.disabled = false;
  continueBtn.disabled = true;
  continueBtn.innerText = "Continue to payment";
  signBtn.disabled = true;
  setStep(1);
  setStatus("");
  updatePricingPreview(null);
}

function updateSummaryFromQuote(route) {
  document.getElementById("sumFunding").innerText =
    formatAmount(route.funding_amount, route.asset || "USDT");

  document.getElementById("sumCountry").innerText =
    document.getElementById("country").value;

  document.getElementById("sumRoute").innerText =
    `${(route.payout_rail || "PIX").toUpperCase()} Instant`;

  summaryBox.style.display = "block";
}

function extractApiErrorMessage(data, fallback = "api_error") {
  if (!data || typeof data !== "object") {
    return fallback;
  }

  if (typeof data.error === "string" && data.error.trim()) {
    return data.error;
  }

  if (
    data.error &&
    typeof data.error === "object" &&
    typeof data.error.message === "string" &&
    data.error.message.trim()
  ) {
    return data.error.message;
  }

  if (typeof data.message === "string" && data.message.trim()) {
    return data.message;
  }

  if (typeof data.raw === "string" && data.raw.trim()) {
    return data.raw;
  }

  return fallback;
}

async function api(path, payload, method = "POST") {
  const options = {
    method,
    headers: { "content-type": "application/json" }
  };

  if (method !== "GET") {
    options.body = JSON.stringify(payload || {});
  }

  const r = await fetch(
    "/api/proxy?endpoint=" + encodeURIComponent(path),
    options
  );

  const text = await r.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!r.ok) {
    throw new Error(extractApiErrorMessage(data));
  }

  return data;
}

async function getStatus(settlementIdValue) {
  const r = await fetch(
    "/api/proxy?endpoint=settlement/status&settlement_id=" +
      encodeURIComponent(settlementIdValue)
  );

  const text = await r.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!r.ok) {
    throw new Error(extractApiErrorMessage(data));
  }

  return data;
}

function getSettlementStatus(data) {
  return String(data?.status || "").trim().toLowerCase();
}

function isTerminalStatus(status) {
  return status === "completed" || status === "failed";
}

function isExecutionTrackingStatus(status) {
  return (
    status === "submitted" ||
    status === "executing" ||
    status === "processing"
  );
}

function updateUIForStatus(data) {
  const status = getSettlementStatus(data);

  if (status === "waiting_ramp_payment") {
    setStep(4);
    hideAllActionBoxes();
    signBtn.disabled = true;
    setStatus("Checking payment...");
    return;
  }

  if (status === "funding_confirmed") {
    setStep(5);
    showSignBox();
    signBtn.disabled = false;
    setStatus("Funding confirmed. Sign and send the transfer.");
    return;
  }

  if (status === "submitted") {
    setStep(6);
    hideAllActionBoxes();
    signBtn.disabled = true;
    setStatus("Transfer submitted to network...");
    return;
  }

  if (status === "executing" || status === "processing") {
    setStep(6);
    hideAllActionBoxes();
    signBtn.disabled = true;
    setStatus("Transfer processing...");
    return;
  }

  if (status === "completed") {
    setStep(6);
    hideAllActionBoxes();
    signBtn.disabled = true;
    setStatus("Transfer completed", "success");
    clearLocalFlowState();
    return;
  }

  if (status === "failed") {
    setStep(6);
    hideAllActionBoxes();
    signBtn.disabled = true;
    setStatus("Transfer failed", "error");
    clearLocalFlowState();
    return;
  }

  setStatus("Unknown settlement state");
}

async function requestSignedExecutionTx(unsignedTx, ctx = {}) {
  const signer = window.UnibridgeSigner?.signSmartPayTx;

  if (typeof signer !== "function") {
    throw new Error("signer_not_connected");
  }

  const signedTx = await signer(unsignedTx, ctx);

  if (
    typeof signedTx !== "string" ||
    !signedTx.trim()
  ) {
    throw new Error("invalid_signed_tx_from_signer");
  }

  return signedTx.trim();
}

/* REGISTER + RESOLVE + QUOTE */

async function startFlow() {
  try {
    sendBtn.disabled = true;
    continueBtn.disabled = true;
    signBtn.disabled = true;

    hideAllActionBoxes();
    summaryBox.style.display = "none";
    taxBox.style.display = "none";
    updatePricingPreview(null);
    pendingWidgetUrl = null;
    continueBtn.innerText = "Continue to payment";

    setStep(1);
    setStatus("Registering...");

    const amount = Number(document.getElementById("amount").value);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Invalid amount");
    }

    const country = document.getElementById("country").value;
    const source = document.getElementById("source_country").value;

    const reg = await api("session/register", {
      source_country: source,
      receiver_country: country
    });

    sessionId = reg.session_id;

    setStatus("Resolving route...");

    const resolve = await api("session/resolve", {
      session_id: sessionId
    });

    if (!resolve?.delivery_options?.execution?.pix) {
      throw new Error("PIX route unavailable");
    }

    setStatus("Getting quote...");

    const quote = await api("session/quote", {
      session_id: sessionId,
      amount
    });

    if (!quote.routes?.length) {
      throw new Error("No routes available");
    }

    currentRoute = quote.routes[0];
    routeId = currentRoute.route_id || currentRoute.id;

    updateSummaryFromQuote(currentRoute);

    setStep(2);
    showFundingForm();
    continueBtn.disabled = false;
    sendBtn.disabled = false;

    if (currentRoute.requires_tax_id) {
      taxBox.style.display = "block";
    }

    document.getElementById("pix").focus();
    setStatus("Enter PIX key");
  } catch (err) {
    console.error(err);
    setStatus(err, "error");
    sendBtn.disabled = false;
    continueBtn.disabled = false;
    signBtn.disabled = true;
  }
}

/* CREATE + FUNDING */

async function continueFlow() {
  try {
    continueBtn.disabled = true;

    /*
    --------------------------------------------------
    Second click:
    open already-prepared payment widget
    --------------------------------------------------
    */

    if (pendingWidgetUrl) {
      markPaymentStarted();
      setStep(3);
      hideAllActionBoxes();
      setStatus("Redirecting to payment...");
      window.location.href = pendingWidgetUrl;
      return;
    }

    const pix = document.getElementById("pix").value.trim();
    const tax_id = document.getElementById("taxId").value.trim();

    if (!pix) {
      throw new Error("PIX required");
    }

    const destination = tax_id ? { pix, tax_id } : { pix };

    setStatus("Creating settlement...");

    const create = await api("settlement/create", {
      session_id: sessionId,
      route_id: routeId,
      destination
    });

    settlementId = create.settlement_id;
    persistSettlement(settlementId);

    setStatus("Preparing payment session...");

    const funding = await api("funding/session", {
      settlement_id: settlementId
    });

    updatePricingPreview(funding.pricing_preview || null);

    if (!funding.widget_url) {
      throw new Error("Ramp unavailable");
    }

    pendingWidgetUrl = funding.widget_url;

    setStep(3);
    showFundingForm();
    continueBtn.innerText = "Open payment";
    continueBtn.disabled = false;
    setStatus("Review estimated payment, then open payment.");
  } catch (err) {
    console.error(err);
    setStatus(err, "error");
    continueBtn.disabled = false;
  }
}

/* FUNDING CONFIRMATION */

async function tryFundingConfirmationOnce() {
  await api("settlement/confirm", {
    settlement_id: settlementId
  });

  return getStatus(settlementId);
}

async function reconcileReturnedPaymentFlow() {
  if (!settlementId) return;
  if (confirmingFunding) return;

  confirmingFunding = true;

  try {
    setStep(4);
    hideAllActionBoxes();
    signBtn.disabled = true;
    setStatus("Checking payment...");

    const startedAt =
      paymentCheckStartedAt ||
      getPaymentStartedAt() ||
      Date.now();

    paymentCheckStartedAt = startedAt;

    while (Date.now() - startedAt < PAYMENT_RECONCILIATION_WINDOW_MS) {
      try {
        const data = await tryFundingConfirmationOnce();
        const status = getSettlementStatus(data);

        updateUIForStatus(data);

        if (
          status === "funding_confirmed" ||
          isExecutionTrackingStatus(status) ||
          isTerminalStatus(status)
        ) {
          clearPaymentStarted();

          if (isExecutionTrackingStatus(status)) {
            startPolling();
          }

          return;
        }
      } catch (err) {
        if (
          err.message !== "funding_not_confirmed" &&
          err.message !== "funding_session_not_ready"
        ) {
          throw err;
        }
      }

      await new Promise((resolve) =>
        setTimeout(resolve, POLL_INTERVAL_MS)
      );
    }

    clearLocalFlowState();
    resetToStartUI();
    setStatus("Payment was not confirmed. Please start again.");
  } catch (err) {
    console.error(err);
    setStatus(err, "error");
  } finally {
    confirmingFunding = false;
  }
}

/* BUILD + SIGN + SUBMIT */

async function signAndSubmitExecution() {
  if (!settlementId) {
    setStatus("Missing settlement", "error");
    return;
  }

  if (submittingExecution) return;
  submittingExecution = true;

  try {
    signBtn.disabled = true;
    setStep(5);
    setStatus("Preparing transfer...");

    const unsignedTx = await api("execution/build-unsigned-tx", {
      settlement_id: settlementId
    });

    setStatus("Waiting for signature...");

    const signedTx = await requestSignedExecutionTx(unsignedTx, {
      settlement_id: settlementId,
      route: currentRoute
    });

    setStatus("Submitting transfer...");

    await api("execution/submit-signed-tx", {
      settlement_id: settlementId,
      signed_tx: signedTx
    });

    setStep(6);
    hideAllActionBoxes();
    setStatus("Transfer submitted");
    startPolling();
  } catch (err) {
    console.error(err);
    signBtn.disabled = false;

    if (err.message === "signer_not_connected") {
      setStatus(
        "Signer not connected. Connect the signer integration first.",
        "error"
      );
    } else {
      setStatus(err, "error");
    }
  } finally {
    submittingExecution = false;
  }
}

/* POLLING */

function stopPolling() {
  if (poller) {
    clearInterval(poller);
    poller = null;
  }
}

function startPolling() {
  if (!settlementId) return;
  if (poller) return;

  poller = setInterval(async () => {
    try {
      const data = await getStatus(settlementId);
      const status = getSettlementStatus(data);

      updateUIForStatus(data);

      if (status === "funding_confirmed") {
        stopPolling();
        return;
      }

      if (isTerminalStatus(status)) {
        stopPolling();
        return;
      }
    } catch (e) {
      console.error(e);
    }
  }, POLL_INTERVAL_MS);
}

/* RESUME AFTER REFRESH */

window.addEventListener("load", async () => {
  const saved = getPersistedSettlement();
  if (!saved) {
    resetToStartUI();
    continueBtn.disabled = true;
    return;
  }

  try {
    settlementId = saved;

    const data = await getStatus(settlementId);
    const status = getSettlementStatus(data);
    const paymentStarted = getPaymentStarted();

    if (status === "waiting_ramp_payment") {
      if (paymentStarted) {
        await reconcileReturnedPaymentFlow();
        return;
      }

      clearLocalFlowState();
      resetToStartUI();
      continueBtn.disabled = true;
      return;
    }

    updateUIForStatus(data);

    if (status === "funding_confirmed") {
      clearPaymentStarted();
      return;
    }

    if (isExecutionTrackingStatus(status)) {
      clearPaymentStarted();
      startPolling();
      return;
    }

    if (isTerminalStatus(status)) {
      return;
    }

    clearLocalFlowState();
    resetToStartUI();
    continueBtn.disabled = true;
  } catch (e) {
    console.error(e);
    clearLocalFlowState();
    resetToStartUI();
    continueBtn.disabled = true;
  }
});

/* RETURN FROM PAYMENT */

window.addEventListener("focus", () => {
  if (!settlementId) return;
  if (!getPaymentStarted()) return;
  if (poller) return;
  if (confirmingFunding) return;

  reconcileReturnedPaymentFlow();
});

sendBtn.onclick = startFlow;
continueBtn.onclick = continueFlow;
signBtn.onclick = signAndSubmitExecution;
