// unibrij/unibridge-landing/surface/js/status.js

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

  function getSettlementViewState(status) {
    const helper =
      window.UnibridgeSettlementViewState;

    if (
      helper &&
      typeof helper.getUserFacingSettlementState === "function"
    ) {
      return helper.getUserFacingSettlementState(status);
    }

    return {
      key: "unknown",
      title: "Status is currently unavailable."
    };
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

    const viewState =
      getSettlementViewState(s);

    /*
    ------------------------------------------------
    User signing is no longer canonical.
    Keep sign button disabled in all public states.
    Manual fallback is now admin-side, not user-side.
    ------------------------------------------------
    */

    if (signBtn) {
      signBtn.disabled = true;
      signBtn.style.display = "none";
    }

    if (s === "waiting_ramp_payment") {
      emit("unibridge:quote");
      emit("unibridge:payment");

      if (continueBtn) {
        continueBtn.disabled = false;
      }

      setStatus("Waiting for payment...");
      return;
    }

    if (
      [
        "funding_confirmed",
        "submitted",
        "executing",
        "processing",
        "execution_retryable",
        "manual_resume_required"
      ].includes(s)
    ) {
      emit("unibridge:quote");
      emit("unibridge:funding");

      if (continueBtn) {
        continueBtn.disabled = true;
      }

      setStatus(viewState.title);
      return;
    }

    if (s === "completed") {
      emit("unibridge:done");

      if (continueBtn) {
        continueBtn.disabled = true;
      }

      setStatus(viewState.title, "success");
      clearState();
      return;
    }

    if (s === "failed") {
      if (continueBtn) {
        continueBtn.disabled = true;
      }

      setStatus(viewState.title, "error");
      clearState();
      return;
    }

    if (continueBtn) {
      continueBtn.disabled = true;
    }

    setStatus(viewState.title);
  }

  return {
    extractErrorMessage,
    resetStatusMemory,
    setStatus,
    handleSettlementStatus
  };
})();
