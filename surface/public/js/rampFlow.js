// unibrij/unibridge-landing/surface/public/js/rampFlow.js

window.UnibridgeRampFlow = (() => {
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

          res = await window.UnibridgeApi.apiPost("ramp/auth/start", {
            settlement_id: getSettlementId(),
            email
          });
        }

        else if (step === "otp_verify") {
          const otp = prompt("Enter OTP");
          if (!otp) throw new Error("otp_required");

          res = await window.UnibridgeApi.apiPost("ramp/auth/verify", {
            settlement_id: getSettlementId(),
            otp
          });
        }

        else if (step === "fetch_user") {
          res = await window.UnibridgeApi.apiGet("ramp/user", {
            settlement_id: getSettlementId()
          });
        }

        else if (step === "kyc_requirement") {
          res = await window.UnibridgeApi.apiGet("ramp/kyc/requirement", {
            settlement_id: getSettlementId()
          });
        }

        else if (step === "kyc_user") {
          res = await window.UnibridgeApi.apiPatch("ramp/kyc/user", {
            settlement_id: getSettlementId(),
            user: buildKycPayload()
          });
        }

        else if (step === "order_create") {
          res = await window.UnibridgeApi.apiPost("ramp/order/create", {
            settlement_id: getSettlementId()
          });
        }

        else if (step === "order_confirm_payment") {
          res = await window.UnibridgeApi.apiPost("ramp/order/confirm-payment", {
            settlement_id: getSettlementId()
          });
        }

        else if (step === "order_status") {
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
          throw new Error("unhandled_step_" + step);
        }

        if (!res) {
          throw new Error("empty_response");
        }

        setCurrentNextAction(
          window.UnibridgeNextAction.normalizeNextAction(res.next_action) || null
        );

        if (!getCurrentNextAction()) {
          setPendingWidgetUrl(
            window.UnibridgeNextAction.extractWidgetUrlFromFunding(res) ||
            getPendingWidgetUrl()
          );
        }
      }

      if (steps >= 12) {
        throw new Error("next_action_loop_detected");
      }
    } catch (e) {
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
