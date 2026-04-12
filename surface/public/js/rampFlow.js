// unibrij/unibridge-landing/surface/public/js/rampFlow.js

window.UnibridgeRampFlow = (() => {
  function getAuthElements() {
    return {
      authBox: document.getElementById("authBox"),
      authTitle: document.getElementById("authTitle"),
      authEmail: document.getElementById("authEmail"),
      authOtp: document.getElementById("authOtp"),
      authBtn: document.getElementById("authBtn"),
      authHint: document.getElementById("authHint")
    };
  }

  function hideAuthUi() {
    const {
      authBox,
      authEmail,
      authOtp,
      authBtn
    } = getAuthElements();

    if (authBox) authBox.style.display = "none";
    if (authEmail) authEmail.style.display = "none";
    if (authOtp) authOtp.style.display = "none";
    if (authBtn) authBtn.style.display = "none";
  }

  function showEmailUi() {
    const {
      authBox,
      authTitle,
      authEmail,
      authOtp,
      authBtn,
      authHint
    } = getAuthElements();

    if (authBox) authBox.style.display = "block";
    if (authTitle) authTitle.innerText = "Verify email";
    if (authEmail) authEmail.style.display = "block";
    if (authOtp) authOtp.style.display = "none";
    if (authBtn) {
      authBtn.style.display = "block";
      authBtn.innerText = "Send code";
    }
    if (authHint) {
      authHint.innerText = "Enter your email to receive a verification code.";
    }
  }

  function showOtpUi() {
    const {
      authBox,
      authTitle,
      authEmail,
      authOtp,
      authBtn,
      authHint
    } = getAuthElements();

    if (authBox) authBox.style.display = "block";
    if (authTitle) authTitle.innerText = "Enter verification code";
    if (authEmail) authEmail.style.display = "none";
    if (authOtp) authOtp.style.display = "block";
    if (authBtn) {
      authBtn.style.display = "block";
      authBtn.innerText = "Verify code";
    }
    if (authHint) {
      authHint.innerText = "Enter the OTP sent to your email.";
    }
  }

  async function waitForAuthAction(mode) {
    return new Promise((resolve, reject) => {
      const {
        authEmail,
        authOtp,
        authBtn
      } = getAuthElements();

      if (!authBtn) {
        reject(new Error("auth_ui_missing"));
        return;
      }

      const handler = () => {
        authBtn.removeEventListener("click", handler);

        if (mode === "email") {
          const email = String(authEmail?.value || "").trim();
          if (!email) {
            reject(new Error("email_required"));
            return;
          }
          resolve(email);
          return;
        }

        if (mode === "otp") {
          const otp = String(authOtp?.value || "").trim();
          if (!otp) {
            reject(new Error("otp_required"));
            return;
          }
          resolve(otp);
          return;
        }

        reject(new Error("invalid_auth_mode"));
      };

      authBtn.addEventListener("click", handler, { once: true });
    });
  }

  async function processStepNextActions(ctx) {
    const {
      getCurrentNextAction,
      setCurrentNextAction,
      getPendingWidgetUrl,
      setPendingWidgetUrl,
      getSettlementId,
      setStatus,
      setContinueDisabled,
      buildKycPayload
    } = ctx;

    if (ctx.getNextActionProcessing()) return;
    ctx.setNextActionProcessing(true);

    try {
      let steps = 0;

      while (getCurrentNextAction() && steps < 12) {
        const action =
          window.UnibridgeNextAction.normalizeNextAction(
            getCurrentNextAction()
          );

        if (!action) {
          setCurrentNextAction(null);
          hideAuthUi();
          return;
        }

        if (action.type !== "step") {
          hideAuthUi();
          return;
        }

        steps += 1;

        const step = action.step;
        let res = null;

        if (step === "email_otp") {
          showEmailUi();
          setContinueDisabled(true);
          const email = await waitForAuthAction("email");

          res = await window.UnibridgeApi.apiPost("ramp/auth/start", {
            settlement_id: getSettlementId(),
            email
          });
        }

        else if (step === "otp_verify") {
          showOtpUi();
          setContinueDisabled(true);
          const otp = await waitForAuthAction("otp");

          res = await window.UnibridgeApi.apiPost("ramp/auth/verify", {
            settlement_id: getSettlementId(),
            otp
          });
        }

        else if (step === "fetch_user") {
          hideAuthUi();
          res = await window.UnibridgeApi.apiGet("ramp/user", {
            settlement_id: getSettlementId()
          });
        }

        else if (step === "kyc_requirement") {
          hideAuthUi();
          res = await window.UnibridgeApi.apiGet("ramp/kyc/requirement", {
            settlement_id: getSettlementId()
          });
        }

        else if (step === "kyc_user") {
          hideAuthUi();
          res = await window.UnibridgeApi.apiPatch("ramp/kyc/user", {
            settlement_id: getSettlementId(),
            user: buildKycPayload()
          });
        }

        else if (step === "order_create") {
          hideAuthUi();
          res = await window.UnibridgeApi.apiPost("ramp/order/create", {
            settlement_id: getSettlementId()
          });
        }

        else if (step === "order_confirm_payment") {
          hideAuthUi();
          res = await window.UnibridgeApi.apiPost("ramp/order/confirm-payment", {
            settlement_id: getSettlementId()
          });
        }

        else if (step === "order_status") {
          hideAuthUi();

          await window.UnibridgeApi.apiGet("ramp/order/status", {
            settlement_id: getSettlementId()
          });

          setCurrentNextAction(null);

          ctx.emit("unibridge:quote");
          ctx.emit("unibridge:payment");
          setContinueDisabled(false);
          setStatus("Waiting for payment confirmation...");

          return;
        }

        else {
          hideAuthUi();
          throw new Error("unhandled_step_" + step);
        }

        if (!res) {
          hideAuthUi();
          throw new Error("empty_response");
        }

        setCurrentNextAction(
          window.UnibridgeNextAction.normalizeNextAction(res.next_action) || null
        );

        if (!getCurrentNextAction()) {
          hideAuthUi();
          setPendingWidgetUrl(
            window.UnibridgeNextAction.extractWidgetUrlFromFunding(res) ||
            getPendingWidgetUrl()
          );
        }
      }

      if (steps >= 12) {
        hideAuthUi();
        throw new Error("next_action_loop_detected");
      }
    } catch (e) {
      hideAuthUi();
      setStatus(e, "error");
      setCurrentNextAction(null);
      setContinueDisabled(false);
    } finally {
      ctx.setNextActionProcessing(false);
    }
  }

  return {
    processStepNextActions
  };
})();
