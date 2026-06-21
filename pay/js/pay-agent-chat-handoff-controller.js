// pay/js/pay-agent-chat-handoff-controller.js

window.UnibridgePayAgentChatHandoffController = (() => {
  function normalizeString(value) {
    const UrlPicker =
      window.UnibridgePayAgentChatUrlPicker;

    if (UrlPicker?.normalizeString) {
      return UrlPicker.normalizeString(value);
    }

    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "object") {
      return "";
    }

    return String(value).trim();
  }

  function normalizeObject(value) {
    const UrlPicker =
      window.UnibridgePayAgentChatUrlPicker;

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

    async function handleWalletFunding({
      label = ""
    } = {}) {
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

    async function handleCardCheckout({
      label = ""
    } = {}) {
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

        const clientSecret =
          UrlPicker?.pickClientSecret
            ? UrlPicker.pickClientSecret(result)
            : normalizeString(
                result.client_secret ||
                  result.next_action?.meta?.client_secret ||
                  result.result?.client_secret ||
                  result.result?.next_action?.meta?.client_secret
              );

        const redirectUrl =
          UrlPicker?.pickRedirectUrl
            ? UrlPicker.pickRedirectUrl(result)
            : "";

        if (clientSecret) {
          Dom.setStatus("card_checkout_ready");

          if (typeof Renderers.renderCardCheckout === "function") {
            Renderers.renderCardCheckout(result);
          } else if (typeof Renderers.renderEmbeddedOnramp === "function") {
            Renderers.renderEmbeddedOnramp(result);
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

    async function handleBankTransferInstructions({
      label = ""
    } = {}) {
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
