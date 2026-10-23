
 // surface/js/status.js

window.UnibridgeStatus = (() => {
  let statusMemory = new WeakMap();

  const ERROR_MESSAGES = {
    saber_kyc_blocked: [
      "Verification needs attention",
      "We couldn't confirm your verification for this transfer. Please contact support if the issue continues."
    ],
    kyc_required: [
      "Verification required",
      "Please complete identity verification to continue."
    ],
    kyc_pending: [
      "Verification in progress",
      "Your verification is still being reviewed."
    ],
    kyc_in_review: [
      "Verification in progress",
      "Your verification is still being reviewed."
    ],
    kyc_rejected: [
      "Verification needs attention",
      "Please review your verification details or contact support."
    ]
  };

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

    return "";
  }

  function resetStatusMemory() {
    statusMemory = new WeakMap();
  }

  function setStatus(statusBox, msg, type) {
    if (!statusBox) return;

    const raw = extractErrorMessage(msg).trim();

    const variant =
      type === "error" || type === "success"
        ? type
        : "info";

    const code = String(
      msg?.code ||
      msg?.error?.code ||
      (
        typeof msg?.error === "string"
          ? msg.error
          : ""
      ) ||
      raw
    ).trim().toLowerCase();

    const key = `${variant}::${code}::${raw}`;

    if (!raw && !code) {
      statusMemory.delete(statusBox);
      statusBox.replaceChildren();
      statusBox.className = "status-box";
      return;
    }

    if (
      statusMemory.get(statusBox) === key &&
      statusBox.classList.contains(`is-${variant}`) &&
      statusBox.querySelector(".status-content")
    ) {
      return;
    }

    statusBox.replaceChildren();
    statusBox.className = "status-box";
    statusBox.classList.add(`is-${variant}`);

    statusBox.setAttribute(
      "role",
      variant === "error" ? "alert" : "status"
    );

    const known =
      variant === "error"
        ? ERROR_MESSAGES[code]
        : null;

    const title =
      variant === "error"
        ? (known?.[0] || "Something needs attention")
        : variant === "success"
          ? "Done"
          : "Status update";

    const message =
      variant === "error"
        ? (
            known?.[1] ||
            "We couldn't complete this step. Please check your transfer status or contact support."
          )
        : raw;

    const content = document.createElement("div");
    content.className = "status-content";

    const icon = document.createElement("span");
    icon.className = "status-icon";
    icon.setAttribute("aria-hidden", "true");

    icon.textContent =
      variant === "error" ? "!" :
      variant === "success" ? "✓" : "i";

    const copy = document.createElement("div");
    copy.className = "status-copy";

    const heading = document.createElement("div");
    heading.className = "status-title";
    heading.textContent = title;

    const description = document.createElement("div");
    description.className = "status-message";
    description.textContent = message;

    copy.append(heading, description);
    content.append(icon, copy);
    statusBox.appendChild(content);

    statusMemory.set(statusBox, key);
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

    const viewState = getSettlementViewState(s);

    /*
    User signing is no longer canonical.
    Manual fallback remains admin-side.
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
