// pay/js/pay-agent-chat-handoff-controller.js

window.UnibridgePayAgentChatHandoffController = (() => {
  function normalizeString(value) {
    const UrlPicker = window.UnibridgePayAgentChatUrlPicker;

    if (UrlPicker?.normalizeString) {
      return UrlPicker.normalizeString(value);
    }

    if (value === null || value === undefined) return "";
    if (typeof value === "object") return "";

    return String(value).trim();
  }

  function normalizeObject(value) {
    const UrlPicker = window.UnibridgePayAgentChatUrlPicker;

    if (UrlPicker?.normalizeObject) {
      return UrlPicker.normalizeObject(value);
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return value;
  }

  function getUrlPicker() {
    return window.UnibridgePayAgentChatUrlPicker || null;
  }

  function pickSettlementId(result = {}) {
    const data = normalizeObject(result);
    const resultData = normalizeObject(data.result);

    return normalizeString(
      data.settlement_id ||
        data.funding_session_id ||
        resultData.settlement_id ||
        resultData.funding_session_id
    );
  }

  async function postFundingSessionDirect(payload = {}) {
    const response = await fetch("/v2/funding/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data =
      await response.json().catch(() => ({}));

    if (!response.ok) {
      throw data || new Error("funding_session_request_failed");
    }

    return data;
  }

  async function callFundingSession({
    Actions,
    settlementId
  } = {}) {
    if (!settlementId) {
      return null;
    }

    const payload = {
      settlement_id: settlementId
    };

    if (typeof Actions.prepareFundingSession === "function") {
      return Actions.prepareFundingSession(payload);
    }

    if (typeof Actions.fetchFundingSession === "function") {
      return Actions.fetchFundingSession(payload);
    }

    if (typeof Actions.apiPost === "function") {
      return Actions.apiPost("funding/session", payload);
    }

    if (window.UnibridgeApi?.apiPost) {
      return window.UnibridgeApi.apiPost("funding/session", payload);
    }

    return postFundingSessionDirect(payload);
  }

  async function resolveFundingSessionFallback({
    Actions,
    initialResult,
    UrlPicker
  } = {}) {
    const settlementId =
      pickSettlementId(initialResult);

    if (!settlementId) {
      return null;
    }

    let funding =
      await callFundingSession({
        Actions,
        settlementId
      });

    if (
      funding?.widget_pending &&
      !UrlPicker?.pickRedirectUrl?.(funding)
    ) {
      await new Promise((resolve) => setTimeout(resolve, 800));

      funding =
        await callFundingSession({
          Actions,
          settlementId
        });
    }

    return funding;
  }

  function create({
    assertModules,
    appendUserSelection,
    appendAssistantError,
    renderFallbackActions,
    getAutoHandoffInFlight,
    setAutoHandoffInFlight,
    getLastAutoHandoffKey,
    setLastAutoHandoffKey
  } = {}) {
    function buildAutoHandoffKey(response = {}) {
      const { Selectors } = assertModules();

      return [
        Selectors?.pickStatus?.(response) || "",
        response.agent_plan_id || "",
        response.settlement_id || "",
        response.funding_session_id || ""
      ].join(":");
    }

    function isAutoHandoffState(status) {
      return (
        status === "card_checkout_required" ||
        status === "bank_transfer_instructions_ready" ||
        status === "wallet_connect_required" ||
        status === "wallet_approval_required"
      );
    }

    function scheduleAutoHandoff(response = {}) {
      setTimeout(() => {
        maybeRunAutoHandoff(response);
      }, 50);
    }

    async function maybeRunAutoHandoff(response = {}) {
      const { Selectors } = assertModules();

      const status =
        Selectors.pickStatus(response);

      const key =
        buildAutoHandoffKey(response);

      if (
        getAutoHandoffInFlight() ||
        !key ||
        key === getLastAutoHandoffKey()
      ) {
        return;
      }

      setLastAutoHandoffKey(key);

      if (status === "card_checkout_required") {
        await handleCardCheckout({ label: "" });
        return;
      }

      if (status === "bank_transfer_instructions_ready") {
        await handleBankTransferInstructions({ label: "" });
        return;
      }

      if (
        status === "wallet_connect_required" ||
        status === "wallet_approval_required"
      ) {
        await handleWalletFunding({ label: "" });
      }
    }

    async function handleWalletFunding({ label = "" } = {}) {
      const { Dom, Actions } = assertModules();

      if (Dom.isBusy() || getAutoHandoffInFlight()) {
        return;
      }

      setAutoHandoffInFlight(true);
      Dom.clearActions();

      if (label) {
        appendUserSelection(label);
      }

      Dom.setBusy(true);
      Dom.setStatus("preparing_wallet_handoff");

      try {
        const result =
          await Actions.prepareWalletHandoff();

        const connectUrl =
          normalizeString(result.connect_url);

        if (!connectUrl) {
          const error =
            new Error("wallet_handoff_missing_connect_url");

          error.code =
            "wallet_handoff_missing_connect_url";

          throw error;
        }

        Dom.setStatus("opening_wallet_checkout");
        window.location.href = connectUrl;
      } catch (error) {
        setLastAutoHandoffKey("");
        appendAssistantError(error);
        Dom.setStatus("error");
        renderFallbackActions();
      } finally {
        setAutoHandoffInFlight(false);
        Dom.setBusy(false);
        Dom.focusInput();
      }
    }

    async function handleCardCheckout({ label = "" } = {}) {
      const { Dom, Renderers, Actions } = assertModules();

      if (Dom.isBusy() || getAutoHandoffInFlight()) {
        return;
      }

      const UrlPicker =
        getUrlPicker();

      setAutoHandoffInFlight(true);
      Dom.clearActions();

      if (label) {
        appendUserSelection(label);
      }

      Dom.setBusy(true);
      Dom.setStatus("preparing_card_checkout");

      try {
        const result =
          await Actions.prepareHandoff();

        let clientSecret =
          UrlPicker?.pickClientSecret
            ? UrlPicker.pickClientSecret(result)
            : normalizeString(
                result.client_secret ||
                  result.next_action?.meta?.client_secret ||
                  result.result?.client_secret ||
                  result.result?.next_action?.meta?.client_secret
              );

        let redirectUrl =
          UrlPicker?.pickRedirectUrl
            ? UrlPicker.pickRedirectUrl(result)
            : "";

        let finalResult =
          result;

        if (!clientSecret && !redirectUrl) {
          Dom.setStatus("preparing_card_widget");

          const fundingSession =
            await resolveFundingSessionFallback({
              Actions,
              initialResult: result,
              UrlPicker
            });

          if (fundingSession) {
            finalResult = {
              ...normalizeObject(result),
              funding_session:
                fundingSession,
              result: {
                ...normalizeObject(result.result),
                funding_session:
                  fundingSession
              },
              ...normalizeObject(fundingSession)
            };

            clientSecret =
              UrlPicker?.pickClientSecret
                ? UrlPicker.pickClientSecret(finalResult)
                : "";

            redirectUrl =
              UrlPicker?.pickRedirectUrl
                ? UrlPicker.pickRedirectUrl(finalResult)
                : "";
          }
        }

        if (clientSecret) {
          Dom.setStatus("card_checkout_ready");

          if (typeof Renderers.renderCardCheckout === "function") {
            Renderers.renderCardCheckout(finalResult);
          } else if (typeof Renderers.renderEmbeddedOnramp === "function") {
            Renderers.renderEmbeddedOnramp(finalResult);
          } else {
            Renderers.appendMessage(
              "assistant",
              "Card checkout is ready. Please complete the embedded checkout."
            );
          }

          return;
        }

        if (redirectUrl) {
          Dom.setStatus("opening_card_checkout");

          Renderers.appendMessage(
            "assistant",
            "Card checkout is ready. Opening the checkout page now."
          );

          window.location.href = redirectUrl;
          return;
        }

        const error =
          new Error("card_checkout_missing_client_secret_or_url");

        error.code =
          "card_checkout_missing_client_secret_or_url";

        throw error;
      } catch (error) {
        setLastAutoHandoffKey("");
        appendAssistantError(error);
        Dom.setStatus("error");
        renderFallbackActions();
      } finally {
        setAutoHandoffInFlight(false);
        Dom.setBusy(false);
        Dom.focusInput();
      }
    }

    async function handleBankTransferInstructions({ label = "" } = {}) {
      const { Dom, Renderers, Actions } = assertModules();

      if (Dom.isBusy() || getAutoHandoffInFlight()) {
        return;
      }

      setAutoHandoffInFlight(true);
      Dom.clearActions();

      if (label) {
        appendUserSelection(label);
      }

      Dom.setBusy(true);
      Dom.setStatus("preparing_bank_transfer_instructions");

      try {
        const result =
          await Actions.prepareHandoff();

        Dom.setStatus("bank_transfer_instructions_ready");

        if (typeof Renderers.renderBankTransferInstructions === "function") {
          Renderers.renderBankTransferInstructions(result);
        } else {
          Renderers.appendMessage(
            "assistant",
            "Bank transfer instructions are ready."
          );
        }
      } catch (error) {
        setLastAutoHandoffKey("");
        appendAssistantError(error);
        Dom.setStatus("error");
        renderFallbackActions();
      } finally {
        setAutoHandoffInFlight(false);
        Dom.setBusy(false);
        Dom.focusInput();
      }
    }

    return {
      buildAutoHandoffKey,
      isAutoHandoffState,
      scheduleAutoHandoff,
      maybeRunAutoHandoff,
      handleWalletFunding,
      handleCardCheckout,
      handleBankTransferInstructions
    };
  }

  return {
    create,
    normalizeString,
    normalizeObject
  };
})();
