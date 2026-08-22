// unibrij/unibridge-landing/surface/js/rampFlow.js

window.UnibridgeRampFlow = (() => {
  const MAX_NEXT_ACTION_STEPS = 12;

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
      authHint.innerText =
        "Enter your email to receive a verification code.";
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
      authHint.innerText =
        "Enter the OTP sent to your email.";
    }
  }

  function waitForAuthAction(mode) {
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
        if (mode === "email") {
          const email =
            String(authEmail?.value || "").trim();

          if (!email) {
            reject(new Error("email_required"));
            return;
          }

          resolve(email);
          return;
        }

        if (mode === "otp") {
          const otp =
            String(authOtp?.value || "").trim();

          if (!otp) {
            reject(new Error("otp_required"));
            return;
          }

          resolve(otp);
          return;
        }

        reject(new Error("invalid_auth_mode"));
      };

      authBtn.addEventListener(
        "click",
        handler,
        { once: true }
      );
    });
  }

  function normalizeNextAction(value) {
    return window.UnibridgeNextAction
      .normalizeNextAction(value);
  }

  function resolveRedirectUrl(
    action,
    response,
    getPendingWidgetUrl
  ) {
    return (
      action?.url ||
      window.UnibridgeNextAction
        .extractWidgetUrlFromFunding(response) ||
      getPendingWidgetUrl() ||
      null
    );
  }

  function finalizePreparedPayment(
    ctx,
    redirectUrl,
    message = "Payment prepared. Tap again to continue."
  ) {
    if (!redirectUrl) {
      throw new Error("missing_redirect_url");
    }

    hideAuthUi();
    ctx.setPendingWidgetUrl(redirectUrl);

    if (typeof ctx.setContinueMode === "function") {
      ctx.setContinueMode("open_payment");
    }

    ctx.emit("unibridge:quote");
    ctx.emit("unibridge:payment");
    ctx.setContinueDisabled(false);
    ctx.setStatus(message);
  }

  async function executeProviderStep(
    ctx,
    action
  ) {
    if (action?.step !== "mount_embedded_onramp") {
      return false;
    }

    if (action.provider === "stripe_onramp") {
      const provider =
        window.UnibridgeStripeOnramp;

      if (
        !provider ||
        typeof provider.mount !== "function"
      ) {
        throw new Error(
          "stripe_onramp_runtime_missing"
        );
      }

      await provider.mount(ctx, action);

      /*
      Stripe embedded session consumes the action.
      */
      ctx.setCurrentNextAction(null);

      return true;
    }

    if (action.provider === "onramp") {
      const provider =
        window.UnibridgeOnrampMoney;

      if (
        !provider ||
        typeof provider.mount !== "function"
      ) {
        throw new Error(
          "onramp_money_runtime_missing"
        );
      }

      await provider.mount(ctx, action);

      /*
      Keep canonical action so the Overlay can be
      reopened using a fresh SDK instance.
      */
      return true;
    }

    return false;
  }

  async function executeLegacyStep(
    ctx,
    action
  ) {
    const step = action?.step;
    const settlementId =
      ctx.getSettlementId();

    if (step === "email_otp") {
      showEmailUi();
      ctx.setContinueDisabled(true);

      const email =
        await waitForAuthAction("email");

      return {
        handled: true,
        response:
          await window.UnibridgeApi.apiPost(
            "ramp/auth/start",
            {
              settlement_id: settlementId,
              email
            }
          )
      };
    }

    if (step === "otp_verify") {
      showOtpUi();
      ctx.setContinueDisabled(true);

      const otp =
        await waitForAuthAction("otp");

      return {
        handled: true,
        response:
          await window.UnibridgeApi.apiPost(
            "ramp/auth/verify",
            {
              settlement_id: settlementId,
              otp
            }
          )
      };
    }

    hideAuthUi();

    if (step === "fetch_user") {
      return {
        handled: true,
        response:
          await window.UnibridgeApi.apiGet(
            "ramp/user",
            {
              settlement_id: settlementId
            }
          )
      };
    }

    if (step === "kyc_requirement") {
      return {
        handled: true,
        response:
          await window.UnibridgeApi.apiGet(
            "ramp/kyc/requirement",
            {
              settlement_id: settlementId
            }
          )
      };
    }

    if (step === "kyc_user") {
      return {
        handled: true,
        response:
          await window.UnibridgeApi.apiPatch(
            "ramp/kyc/user",
            {
              settlement_id: settlementId,
              user: ctx.buildKycPayload()
            }
          )
      };
    }

    if (step === "order_create") {
      return {
        handled: true,
        response:
          await window.UnibridgeApi.apiPost(
            "ramp/order/create",
            {
              settlement_id: settlementId
            }
          )
      };
    }

    if (step === "order_confirm_payment") {
      return {
        handled: true,
        response:
          await window.UnibridgeApi.apiPost(
            "ramp/order/confirm-payment",
            {
              settlement_id: settlementId
            }
          )
      };
    }

    if (step === "order_status") {
      await window.UnibridgeApi.apiGet(
        "ramp/order/status",
        {
          settlement_id: settlementId
        }
      );

      ctx.setCurrentNextAction(null);

      ctx.emit("unibridge:quote");
      ctx.emit("unibridge:payment");

      ctx.setContinueDisabled(false);
      ctx.setStatus(
        "Waiting for payment confirmation..."
      );

      return {
        handled: true,
        terminal: true
      };
    }

    return {
      handled: false
    };
  }

  function isRetryableProviderAction(action) {
    return (
      action?.type === "step" &&
      action?.provider === "onramp" &&
      action?.step === "mount_embedded_onramp"
    );
  }

  async function processStepNextActions(ctx) {
    if (ctx.getNextActionProcessing()) {
      return;
    }

    ctx.setNextActionProcessing(true);

    try {
      let steps = 0;

      while (
        ctx.getCurrentNextAction() &&
        steps < MAX_NEXT_ACTION_STEPS
      ) {
        const action =
          normalizeNextAction(
            ctx.getCurrentNextAction()
          );

        if (!action) {
          ctx.setCurrentNextAction(null);
          hideAuthUi();
          return;
        }

        /*
        --------------------------------------------------
        Redirect
        --------------------------------------------------
        Prepare only. app.js opens it on the next tap.
        --------------------------------------------------
        */
        if (action.type === "redirect") {
          const redirectUrl =
            resolveRedirectUrl(
              action,
              null,
              ctx.getPendingWidgetUrl
            );

          finalizePreparedPayment(
            ctx,
            redirectUrl
          );

          return;
        }

        if (action.type !== "step") {
          hideAuthUi();
          return;
        }

        steps += 1;

        /*
        --------------------------------------------------
        Provider SDK step
        --------------------------------------------------
        */
        const providerHandled =
          await executeProviderStep(
            ctx,
            action
          );

        if (providerHandled) {
          return;
        }

        /*
        --------------------------------------------------
        Legacy / WhiteLabel step
        --------------------------------------------------
        */
        const result =
          await executeLegacyStep(
            ctx,
            action
          );

        if (!result?.handled) {
          throw new Error(
            "unhandled_step_" +
            action.step
          );
        }

        if (result.terminal) {
          return;
        }

        const response =
          result.response;

        if (!response) {
          throw new Error(
            "empty_response"
          );
        }

        /*
        --------------------------------------------------
        Advance canonical next_action
        --------------------------------------------------
        */
        ctx.setCurrentNextAction(
          normalizeNextAction(
            response.next_action
          ) ||
          null
        );

        const updatedAction =
          normalizeNextAction(
            ctx.getCurrentNextAction()
          );

        /*
        --------------------------------------------------
        Response switched to redirect
        --------------------------------------------------
        */
        if (updatedAction?.type === "redirect") {
          const redirectUrl =
            resolveRedirectUrl(
              updatedAction,
              response,
              ctx.getPendingWidgetUrl
            );

          finalizePreparedPayment(
            ctx,
            redirectUrl
          );

          return;
        }

        /*
        --------------------------------------------------
        Legacy redirect recovery
        --------------------------------------------------
        */
        if (!ctx.getCurrentNextAction()) {
          const redirectUrl =
            window.UnibridgeNextAction
              .extractWidgetUrlFromFunding(
                response
              ) ||
            ctx.getPendingWidgetUrl() ||
            null;

          if (redirectUrl) {
            finalizePreparedPayment(
              ctx,
              redirectUrl
            );

            return;
          }
        }
      }

      if (
        steps >=
        MAX_NEXT_ACTION_STEPS
      ) {
        throw new Error(
          "next_action_loop_detected"
        );
      }
    } catch (error) {
      hideAuthUi();

      ctx.setStatus(
        error,
        "error"
      );

      const currentAction =
        normalizeNextAction(
          ctx.getCurrentNextAction()
        );

      /*
      Onramp Overlay can be reopened from the same
      canonical action. Other failed actions are cleared.
      */
      if (
        !isRetryableProviderAction(
          currentAction
        )
      ) {
        ctx.setCurrentNextAction(null);
      }

      ctx.setContinueDisabled(false);
    } finally {
      ctx.setNextActionProcessing(false);
    }
  }

  return {
    processStepNextActions
  };
})();
