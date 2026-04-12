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
   EVENTS
========================= */

function emit(name) {
  window.dispatchEvent(new Event(name));
}

/* =========================
   HELPERS
========================= */

let lastStatusKey = null;

function extractErrorMessage(msg) {
  if (!msg) return "";

  if (typeof msg === "string") {
    return msg;
  }

  if (typeof msg?.message === "string") {
    return msg.message;
  }

  if (typeof msg?.error === "string") {
    return msg.error;
  }

  if (typeof msg?.error?.message === "string") {
    return msg.error.message;
  }

  if (typeof msg?.raw === "string") {
    return msg.raw;
  }

  try {
    return JSON.stringify(msg);
  } catch {
    return String(msg);
  }
}

function setStatus(msg, type) {
  const text = extractErrorMessage(msg) || "";
  const key = `${type || ""}::${text}`;

  if (key === lastStatusKey) return;
  lastStatusKey = key;

  statusBox.innerText = text;
  statusBox.className = "";

  if (type === "error") statusBox.classList.add("status-error");
  if (type === "success") statusBox.classList.add("status-success");
}

async function parseResponse(r) {
  const text = await r.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!r.ok) {
    const msg =
      typeof data?.error === "string"
        ? data.error
        : data?.error?.message ||
          data?.message ||
          data?.raw ||
          "api_error";

    throw new Error(msg);
  }

  return data;
}

async function apiPost(path, payload) {
  const r = await fetch(
    "/api/proxy?endpoint=" + encodeURIComponent(path),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload || {})
    }
  );

  return parseResponse(r);
}

async function apiPatch(path, payload) {
  const r = await fetch(
    "/api/proxy?endpoint=" + encodeURIComponent(path),
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload || {})
    }
  );

  return parseResponse(r);
}

async function apiGet(path, query = {}) {
  const url = new URL("/api/proxy", window.location.origin);
  url.searchParams.set("endpoint", path);

  Object.entries(query || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  });

  const r = await fetch(url.toString(), {
    method: "GET"
  });

  return parseResponse(r);
}

function getValue(id) {
  return document.getElementById(id);
}

function normalizeNextAction(action) {
  if (!action || typeof action !== "object") {
    return null;
  }

  const type =
    typeof action.type === "string"
      ? action.type.trim()
      : action.step
        ? "step"
        : (
            action.url ||
            action.redirect_url ||
            action.fallback_widget_url
          )
          ? "redirect"
          : null;

  if (!type) {
    return null;
  }

  const provider =
    typeof action.provider === "string"
      ? action.provider.trim()
      : null;

  const step =
    typeof action.step === "string"
      ? action.step.trim()
      : null;

  const meta =
    action.meta &&
    typeof action.meta === "object" &&
    !Array.isArray(action.meta)
      ? { ...action.meta }
      : {};

  const url =
    (typeof action.url === "string" && action.url.trim()) ||
    (typeof action.redirect_url === "string" && action.redirect_url.trim()) ||
    (typeof action.fallback_widget_url === "string" && action.fallback_widget_url.trim()) ||
    (typeof meta.url === "string" && meta.url.trim()) ||
    (typeof meta.redirect_url === "string" && meta.redirect_url.trim()) ||
    (typeof meta.fallback_widget_url === "string" && meta.fallback_widget_url.trim()) ||
    null;

  return {
    type,
    provider,
    step: type === "step" ? step : null,
    url: type === "redirect" ? url : null,
    label:
      typeof action.label === "string"
        ? action.label.trim()
        : null,
    blocking:
      typeof action.blocking === "boolean"
        ? action.blocking
        : true,
    meta
  };
}

function extractWidgetUrlFromFunding(funding) {
  const normalizedAction =
    normalizeNextAction(funding?.next_action);

  return (
    funding?.widget?.url ||
    funding?.widget_url ||
    normalizedAction?.url ||
    normalizedAction?.meta?.fallback_widget_url ||
    normalizedAction?.meta?.redirect_url ||
    normalizedAction?.meta?.url ||
    null
  );
}

function isTerminalOrAdvancedSettlementStatus(status) {
  return (
    status === "funding_confirmed" ||
    ["submitted", "executing", "processing", "completed", "failed"].includes(status)
  );
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
   STATUS HANDLER
========================= */

function handleSettlementStatus(status) {
  const s = status?.status;

  if (!s) return;

  if (s === "waiting_ramp_payment") {
    emit("unibridge:quote");
    emit("unibridge:payment");
    signBtn.disabled = true;
    setStatus("Waiting for payment...");
    return;
  }

  if (s === "funding_confirmed") {
    emit("unibridge:quote");
    emit("unibridge:ready");
    signBtn.disabled = false;
    continueBtn.disabled = true;
    setStatus("Ready to sign transfer", "success");
    return;
  }

  if (["submitted", "executing", "processing"].includes(s)) {
    emit("unibridge:quote");
    emit("unibridge:funding");
    signBtn.disabled = true;
    continueBtn.disabled = true;
    setStatus("Transfer in progress...");
    return;
  }

  if (s === "completed") {
    emit("unibridge:done");
    signBtn.disabled = true;
    continueBtn.disabled = true;
    setStatus("Transfer completed", "success");
    clearState();
    return;
  }

  if (s === "failed") {
    signBtn.disabled = true;
    continueBtn.disabled = true;
    setStatus("Transfer failed", "error");
    clearState();
    return;
  }
}

async function refreshSettlementState() {
  if (!settlementId) return null;

  const status = await apiGet("settlement/status", {
    settlement_id: settlementId
  });

  handleSettlementStatus(status);
  return status;
}

/* =========================
   START
========================= */

async function startFlow() {
  if (processing) return;

  try {
    clearState();
    lastStatusKey = null;

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
   NEXT ACTION FLOW
========================= */

async function processStepNextActions() {
  if (nextActionProcessing) return;

  nextActionProcessing = true;

  try {
    let steps = 0;

    while (currentNextAction && steps < 12) {
      const action = normalizeNextAction(currentNextAction);

      if (!action) {
        currentNextAction = null;
        return;
      }

      if (action.type !== "step") {
        return;
      }

      steps += 1;

      const step = action.step;
      let res = null;

      if (step === "email_otp") {
        const email = prompt("Enter email");
        if (!email) throw new Error("email_required");

        res = await apiPost("ramp/auth/start", {
          settlement_id: settlementId,
          email
        });
      }

      else if (step === "otp_verify") {
        const otp = prompt("Enter OTP");
        if (!otp) throw new Error("otp_required");

        res = await apiPost("ramp/auth/verify", {
          settlement_id: settlementId,
          otp
        });
      }

      else if (step === "fetch_user") {
        res = await apiGet("ramp/user", {
          settlement_id: settlementId
        });
      }

      else if (step === "kyc_requirement") {
        res = await apiGet("ramp/kyc/requirement", {
          settlement_id: settlementId
        });
      }

      else if (step === "kyc_user") {
        res = await apiPatch("ramp/kyc/user", {
          settlement_id: settlementId,
          user: buildKycPayload()
        });
      }

      else if (step === "order_create") {
        res = await apiPost("ramp/order/create", {
          settlement_id: settlementId
        });
      }

      else if (step === "order_confirm_payment") {
        res = await apiPost("ramp/order/confirm-payment", {
          settlement_id: settlementId
        });
      }

      else if (step === "order_status") {
        await apiGet("ramp/order/status", {
          settlement_id: settlementId
        });

        currentNextAction = null;

        emit("unibridge:quote");
        emit("unibridge:payment");
        continueBtn.disabled = false;
        setStatus("Waiting for payment confirmation...");

        return;
      }

      else {
        throw new Error("unhandled_step_" + step);
      }

      if (!res) {
        throw new Error("empty_response");
      }

      currentNextAction =
        normalizeNextAction(res.next_action) || null;

      if (!currentNextAction) {
        pendingWidgetUrl =
          extractWidgetUrlFromFunding(res) || pendingWidgetUrl;
      }
    }

    if (steps >= 12) {
      throw new Error("next_action_loop_detected");
    }
  } catch (e) {
    setStatus(e, "error");
    currentNextAction = null;
    continueBtn.disabled = false;
  } finally {
    nextActionProcessing = false;
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
      await processStepNextActions();
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
   SIGN (MANUAL — REPO MATCH)
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
   RESUME / RETURN
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
