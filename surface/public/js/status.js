// unibrij/unibridge-landing/surface/public/js/status.js

window.UnibridgeStatus = (() => {
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

  function resetStatusMemory() {
    lastStatusKey = null;
  }

  function setStatus(statusBox, msg, type) {
    const text = extractErrorMessage(msg) || "";
    const key = `${type || ""}::${text}`;

    if (key === lastStatusKey) return;
    lastStatusKey = key;

    statusBox.innerText = text;
    statusBox.className = "";

    if (type === "error") statusBox.classList.add("status-error");
    if (type === "success") statusBox.classList.add("status-success");
  }

  function handleSettlementStatus({
    status,
    signBtn,
    continueBtn,
    emit,
    setStatus,
    clearState
  }) {
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
    }
  }

  return {
    extractErrorMessage,
    resetStatusMemory,
    setStatus,
    handleSettlementStatus
  };
})();
