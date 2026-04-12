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
   STORAGE
========================= */

function persistSettlement(id) {
  if (!id) return;

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      id,
      ts: Date.now()
    })
  );
}

function getPersistedSettlement() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw);

    if (!data?.id) return null;

    if (Date.now() - data.ts > 30 * 60 * 1000) {
      clearState();
      return null;
    }

    return data.id;
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

  localStorage.removeItem(STORAGE_KEY);
  signBtn.disabled = true;
  continueBtn.disabled = true;
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

    getValue("sumAmount").innerText = amount;
    getValue("sumCountry").innerText = "Brazil";

    emit("unibridge:quote");

    continueBtn.disabled = false;
    setStatus("Enter PIX key");
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
    if (pendingWidgetUrl) {
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

      const destination = taxId ? { pix, tax_id: taxId } : { pix };

      const create = await apiPost("settlement/create", {
        session_id: sessionId,
        route_id: routeId,
        destination
      });

      settlementId = create.settlement_id;
      persistSettlement(settlementId);
    }

    const latestStatus = await refreshSettlementState();

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

    const action = normalizeNextAction(currentNextAction);

    if (action?.type === "redirect") {
      const redirectUrl =
        action.url || pendingWidgetUrl;

      if (!redirectUrl) {
        throw new Error("missing_redirect_url");
      }

      pendingWidgetUrl = redirectUrl;
      window.location.href = redirectUrl;
      return;
    }

    if (action?.type === "await_confirmation") {
      emit("unibridge:quote");
      emit("unibridge:payment");
      setStatus(action.label || "Waiting for payment confirmation...");
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
          pendingWidgetUrl = value;
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
      setStatus("Ready for payment");
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
    emit("unibridge:quote");

    const status = await refreshSettlementState();

    if (!status) return;

    if (status.status === "waiting_ramp_payment") {
      const funding = await apiPost("funding/session", {
        settlement_id: settlementId
      });

      currentNextAction =
        normalizeNextAction(funding?.next_action);

      pendingWidgetUrl =
        extractWidgetUrlFromFunding(funding);

      if (pendingWidgetUrl || currentNextAction) {
        continueBtn.disabled = false;
      }
    }
  } catch (e) {
    setStatus(e, "error");
  }
}

window.addEventListener("load", async () => {
  const saved = getPersistedSettlement();
  if (!saved) return;

  settlementId = saved;
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
