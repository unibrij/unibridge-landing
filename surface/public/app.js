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

let executionPolling = null;

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
   HELPERS
========================= */

function setStatus(msg, type) {
  statusBox.innerText = msg?.message || msg || "";
  statusBox.className = "";

  if (type === "error") statusBox.classList.add("status-error");
  if (type === "success") statusBox.classList.add("status-success");
}

async function api(path, payload) {
  const r = await fetch("/api/proxy?endpoint=" + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload || {})
  });

  const text = await r.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!r.ok) {
    throw new Error(data.error || data.message || "api_error");
  }

  return data;
}

/* =========================
   STORAGE (WITH EXPIRY)
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

  if (executionPolling) {
    clearInterval(executionPolling);
    executionPolling = null;
  }

  localStorage.removeItem(STORAGE_KEY);
  signBtn.disabled = true;
}

/* =========================
   AUTO EXECUTION
========================= */

async function tryAutoExecute() {
  if (processing) return false;
  processing = true;

  try {
    const status = await api("settlement/status", {
      settlement_id: settlementId
    });

    if (!status?.execution_ready) {
      return false; // silent
    }

    setStatus("Auto executing...", "success");

    const unsignedTx = await api("execution/build-unsigned-tx", {
      settlement_id: settlementId
    });

    const signer = window.UnibridgeSigner?.signSmartPayTx;

    if (!signer) {
      setStatus("Wallet not connected", "error");
      signBtn.disabled = false;
      return false;
    }

    const signedTx = await signer(unsignedTx);

    if (!signedTx || typeof signedTx !== "string") {
      throw new Error("invalid_signed_tx");
    }

    await api("execution/submit-signed-tx", {
      settlement_id: settlementId,
      signed_tx: signedTx
    });

    setStatus("Executed successfully", "success");
    clearState();

    return true;

  } catch (e) {
    setStatus(e, "error");
    signBtn.disabled = false;
    return false;
  } finally {
    processing = false;
  }
}

/* =========================
   EXECUTION POLLING
========================= */

function startExecutionPolling() {
  if (executionPolling) {
    clearInterval(executionPolling);
  }

  executionPolling = setInterval(async () => {
    const done = await tryAutoExecute();
    if (done) {
      clearInterval(executionPolling);
      executionPolling = null;
    }
  }, 3000);
}

/* =========================
   KYC AUTO-FILL
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
   START
========================= */

async function startFlow() {
  if (processing) return;

  try {
    processing = true;

    sendBtn.disabled = true;
    continueBtn.disabled = true;

    setStatus("Registering...");

    const amount = Number(document.getElementById("amount").value);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("invalid_amount");
    }

    const reg = await api("session/register", {
      source_country: document.getElementById("source_country").value,
      receiver_country: document.getElementById("country").value
    });

    sessionId = reg.session_id;

    await api("session/resolve", { session_id: sessionId });

    const quote = await api("session/quote", {
      session_id: sessionId,
      amount
    });

    if (!quote.routes?.length) {
      throw new Error("no_routes");
    }

    routeId = quote.routes[0].route_id;

    continueBtn.disabled = false;
    setStatus("Enter PIX key");

  } catch (e) {
    setStatus(e, "error");
  } finally {
    processing = false;
    sendBtn.disabled = false;
  }
}

/* =========================
   WHITELABEL LOOP
========================= */

async function processNextActions() {
  if (nextActionProcessing) return;

  nextActionProcessing = true;
  continueBtn.disabled = true;

  try {
    let steps = 0;

    while (currentNextAction && steps < 10) {
      steps++;

      const step = currentNextAction.step;
      setStatus("Processing: " + step);

      let res;

      try {
        if (step === "email_otp") {
          const email = prompt("Enter email");
          if (!email) throw new Error("email_required");

          res = await api("ramp/auth/start", {
            settlement_id: settlementId,
            email
          });
        }

        else if (step === "otp_verify") {
          const otp = prompt("Enter OTP");
          if (!otp) throw new Error("otp_required");

          res = await api("ramp/auth/verify", {
            settlement_id: settlementId,
            otp
          });
        }

        else if (step === "fetch_user") {
          res = await api("ramp/auth/user", {
            settlement_id: settlementId
          });
        }

        else if (step === "kyc_requirement") {
          res = await api("ramp/kyc/requirement", {
            settlement_id: settlementId
          });
        }

        else if (step === "kyc_user") {
          res = await api("ramp/kyc/user", {
            settlement_id: settlementId,
            user: buildKycPayload()
          });
        }

        else if (step === "order_create") {
          res = await api("ramp/order/create", {
            settlement_id: settlementId
          });
        }

        else if (
          step === "order_confirm_payment" ||
          step === "order_status"
        ) {
          currentNextAction = null;

          setStatus("Waiting for payment confirmation...");
          startExecutionPolling();

          continueBtn.disabled = false;
          return;
        }

        else {
          throw new Error("unhandled_step_" + step);
        }

      } catch (e) {
        setStatus(e, "error");
        currentNextAction = null;
        continueBtn.disabled = false;
        return;
      }

      if (!res) {
        setStatus("Empty response", "error");
        currentNextAction = null;
        continueBtn.disabled = false;
        return;
      }

      currentNextAction = res.next_action || null;
    }

    if (steps >= 10) {
      setStatus("Loop detected", "error");
      currentNextAction = null;
      continueBtn.disabled = false;
    }

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
    continueBtn.disabled = true;

    if (pendingWidgetUrl) {
      continueBtn.disabled = false;
      window.location.href = pendingWidgetUrl;
      return;
    }

    processing = true;

    const pix = document.getElementById("pix").value.trim();
    if (!pix) throw new Error("PIX_required");

    if (!settlementId) {
      const create = await api("settlement/create", {
        session_id: sessionId,
        route_id: routeId,
        destination: { pix }
      });

      settlementId = create.settlement_id;
      persistSettlement(settlementId);
    }

    if (!currentNextAction && !pendingWidgetUrl) {
      const funding = await api("funding/session", {
        settlement_id: settlementId
      });

      if (funding?.next_action) {
        currentNextAction = funding.next_action;
      } else if (funding?.widget_url) {
        pendingWidgetUrl = funding.widget_url;
      } else {
        throw new Error("invalid_funding_state");
      }
    }

    if (currentNextAction) {
      await processNextActions();
      continueBtn.disabled = false;
      return;
    }

    if (pendingWidgetUrl) {
      continueBtn.innerText = "Open payment";
      continueBtn.disabled = false;
      setStatus("Ready for payment");
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
   RESUME
========================= */

window.addEventListener("load", async () => {
  const saved = getPersistedSettlement();
  if (!saved) return;

  settlementId = saved;

  setStatus("Resuming...");

  try {
    const executed = await tryAutoExecute();
    if (executed) return;

    const funding = await api("funding/session", {
      settlement_id: settlementId
    });

    if (funding?.next_action) {
      currentNextAction = funding.next_action;
      await processNextActions();
      return;
    }

    if (funding?.widget_url) {
      pendingWidgetUrl = funding.widget_url;
      continueBtn.innerText = "Open payment";
      continueBtn.disabled = false;
      setStatus("Resume payment");
    }

  } catch (e) {
    setStatus(e, "error");
  }
});

/* =========================
   EVENTS
========================= */

sendBtn.onclick = startFlow;
continueBtn.onclick = continueFlow;
signBtn.onclick = tryAutoExecute;
