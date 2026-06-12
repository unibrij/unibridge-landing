// unibrij/unibridge-landing/surface/js/rampFlow.js

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

      authBtn.addEventListener("click", handler, {
        once: true
      });
    });
  }

  function resolveRedirectUrl(action, res, getPendingWidgetUrl) {
    return (
      action?.url ||
      window.UnibridgeNextAction.extractWidgetUrlFromFunding(res) ||
      getPendingWidgetUrl() ||
      null
    );
  }

  function finalizePreparedPayment(ctx, redirectUrl, message) {
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
    ctx.setStatus(
      message || "Payment prepared. Tap again to continue."
    );
  }

  function getStripeOnrampContainer() {
    let container =
      document.getElementById("stripeOnrampContainer");

    if (container) {
      return container;
    }

    const statusBox =
      document.getElementById("status");

    container =
      document.createElement("div");

    container.id =
      "stripeOnrampContainer";

    container.style.width =
      "100%";

    container.style.minHeight =
      "620px";

    container.style.marginTop =
      "16px";

    container.style.borderRadius =
      "20px";

    container.style.overflow =
      "hidden";

    if (statusBox?.parentNode) {
      statusBox.parentNode.insertBefore(
        container,
        statusBox
      );
    } else {
      document.body.appendChild(container);
    }

    return container;
  }

  function loadScriptOnce(src, globalName) {
    return new Promise((resolve, reject) => {
      if (
        globalName &&
        window[globalName]
      ) {
        resolve(true);
        return;
      }

      const existing =
        document.querySelector(
          `script[src="${src}"]`
        );

      if (existing) {
        existing.addEventListener(
          "load",
          () => resolve(true),
          { once: true }
        );

        existing.addEventListener(
          "error",
          () => reject(new Error("script_load_failed")),
          { once: true }
        );

        return;
      }

      const script =
        document.createElement("script");

      script.src =
        src;

      script.async =
        true;

      script.onload =
        () => resolve(true);

      script.onerror =
        () => reject(new Error("script_load_failed"));

      document.head.appendChild(script);
    });
  }

  async function ensureStripeOnrampSdk() {
    await loadScriptOnce(
      "https://js.stripe.com/clover/stripe.js",
      "Stripe"
    );

    await loadScriptOnce(
      "https://crypto-js.stripe.com/crypto-onramp-outer.js",
      "StripeOnramp"
    );

    if (
      typeof window.StripeOnramp !== "function"
    ) {
      throw new Error("stripe_onramp_sdk_missing");
    }
  }

  async function mountStripeEmbeddedOnramp(ctx, action) {
    const meta =
      action?.meta || {};

    const clientSecret =
      typeof meta.client_secret === "string"
        ? meta.client_secret.trim()
        : "";

    const publishableKey =
      typeof meta.publishable_key === "string"
        ? meta.publishable_key.trim()
        : "";

    if (!clientSecret) {
      throw new Error("missing_stripe_onramp_client_secret");
    }

    if (!publishableKey) {
      throw new Error("missing_stripe_publishable_key");
    }

    await ensureStripeOnrampSdk();

    hideAuthUi();

    const container =
      getStripeOnrampContainer();

    container.innerHTML =
      "";

    if (typeof ctx.setCurrentNextAction === "function") {
      ctx.setCurrentNextAction(null);
    }

    ctx.setContinueDisabled(true);

    ctx.setStatus(
      "Opening Stripe payment..."
    );

    const stripeOnramp =
      window.StripeOnramp(publishableKey);

    const session =
      stripeOnramp.createSession({
        clientSecret,
        appearance: {
          theme: "dark"
        }
      });

    if (
      session &&
      typeof session.addEventListener === "function"
    ) {
      session.addEventListener(
        "onramp_session_updated",
        (event) => {
          const stripeSession =
            event?.payload?.session || null;

          const status =
            stripeSession?.status || null;

          console.log("STRIPE_ONRAMP_SESSION_UPDATED", {
            status,
            session_id:
              stripeSession?.id || null
          });

          if (
            status === "fulfillment_complete"
          ) {
            ctx.emit("unibridge:payment");
            ctx.setStatus(
              "Payment submitted. Waiting for on-chain confirmation..."
            );
            return;
          }

          if (
            status === "rejected"
          ) {
            ctx.setContinueDisabled(false);
            ctx.setStatus(
              "Stripe payment was not completed.",
              "error"
            );
            return;
          }

          ctx.setStatus(
            "Complete the payment in the Stripe widget."
          );
        }
      );
    }

    if (
      !session ||
      typeof session.mount !== "function"
    ) {
      throw new Error("stripe_onramp_session_mount_missing");
    }

    session.mount(
      "#stripeOnrampContainer"
    );

    ctx.emit("unibridge:quote");
    ctx.emit("unibridge:payment");

    ctx.setStatus(
      "Complete the payment in the Stripe widget."
    );

    return true;
  }

  async function processStepNextActions(ctx) {
    const {
      getCurrentNextAction,
      setCurrentNextAction,
      getPendingWidgetUrl,
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

        /*
        --------------------------------------------------
        Redirect handling aligned with app.js
        --------------------------------------------------
        Do NOT navigate immediately.
        Prepare payment and let app.js open it on next tap.
        --------------------------------------------------
        */
        if (action.type === "redirect") {
          const redirectUrl =
            resolveRedirectUrl(
              action,
              null,
              getPendingWidgetUrl
            );

          finalizePreparedPayment(
            ctx,
            redirectUrl,
            "Payment prepared. Tap again to continue."
          );
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

          const email =
            await waitForAuthAction("email");

          res = await window.UnibridgeApi.apiPost(
            "ramp/auth/start",
            {
              settlement_id: getSettlementId(),
              email
            }
          );
        }

        else if (step === "otp_verify") {
          showOtpUi();
          setContinueDisabled(true);

          const otp =
            await waitForAuthAction("otp");

          res = await window.UnibridgeApi.apiPost(
            "ramp/auth/verify",
            {
              settlement_id: getSettlementId(),
              otp
            }
          );
        }

        else if (step === "fetch_user") {
          hideAuthUi();

          res = await window.UnibridgeApi.apiGet(
            "ramp/user",
            {
              settlement_id: getSettlementId()
            }
          );
        }

        else if (step === "kyc_requirement") {
          hideAuthUi();

          res = await window.UnibridgeApi.apiGet(
            "ramp/kyc/requirement",
            {
              settlement_id: getSettlementId()
            }
          );
        }

        else if (step === "kyc_user") {
          hideAuthUi();

          res = await window.UnibridgeApi.apiPatch(
            "ramp/kyc/user",
            {
              settlement_id: getSettlementId(),
              user: buildKycPayload()
            }
          );
        }

        else if (step === "order_create") {
          hideAuthUi();

          res = await window.UnibridgeApi.apiPost(
            "ramp/order/create",
            {
              settlement_id: getSettlementId()
            }
          );
        }

        else if (step === "order_confirm_payment") {
          hideAuthUi();

          res = await window.UnibridgeApi.apiPost(
            "ramp/order/confirm-payment",
            {
              settlement_id: getSettlementId()
            }
          );
        }

        else if (step === "order_status") {
          hideAuthUi();

          await window.UnibridgeApi.apiGet(
            "ramp/order/status",
            {
              settlement_id: getSettlementId()
            }
          );

          setCurrentNextAction(null);

          ctx.emit("unibridge:quote");
          ctx.emit("unibridge:payment");
          setContinueDisabled(false);
          setStatus("Waiting for payment confirmation...");

          return;
        }

        else if (
          step === "mount_embedded_onramp" &&
          action.provider === "stripe_onramp"
        ) {
          await mountStripeEmbeddedOnramp(
            ctx,
            action
          );

          setCurrentNextAction(null);

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
          window.UnibridgeNextAction.normalizeNextAction(
            res.next_action
          ) || null
        );

        const updatedAction =
          window.UnibridgeNextAction.normalizeNextAction(
            getCurrentNextAction()
          );

        /*
        --------------------------------------------------
        If response switched to redirect, prepare payment
        but do NOT navigate immediately.
        --------------------------------------------------
        */
        if (updatedAction?.type === "redirect") {
          const redirectUrl =
            resolveRedirectUrl(
              updatedAction,
              res,
              getPendingWidgetUrl
            );

          finalizePreparedPayment(
            ctx,
            redirectUrl,
            "Payment prepared. Tap again to continue."
          );
          return;
        }

        if (!getCurrentNextAction()) {
          hideAuthUi();

          const redirectUrl =
            window.UnibridgeNextAction.extractWidgetUrlFromFunding(res) ||
            getPendingWidgetUrl() ||
            null;

          if (redirectUrl) {
            finalizePreparedPayment(
              ctx,
              redirectUrl,
              "Payment prepared. Tap again to continue."
            );
            return;
          }
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
