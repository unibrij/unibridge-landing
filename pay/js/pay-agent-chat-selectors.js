// pay/js/pay-agent-chat-selectors.js

window.UnibridgePayAgentChatSelectors = (() => {
  const FUNDING_METHOD_IDS = {
    wallet: "wallet",
    card: "card",
    bankTransfer: "bank_transfer"
  };

  const INTERNAL_REPLY_TOKENS = new Set([
    "needs_clarification",
    "missing_pay_agent_plan_id",
    "missing_pay_agent_turn_message",
    "pay_agent_turn",
    "pay_agent_llm_turn",
    "pay_agent_deterministic_turn",
    "pay_agent_beneficiary_answer",
    "pay_agent_turn_state_refreshed",

    "language_required",
    "destination_required",
    "funding_type_required",
    "stablecoin_asset_required",
    "fiat_currency_required",
    "amount_required",
    "beneficiary_required",
    "review_required",
    "quote_required",
    "materializing",
    "handoff_required",
    "wallet_connect_required",
    "wallet_approval_required",
    "card_checkout_required",
    "bank_transfer_instructions_ready",
    "kyc_required",
    "support_required",

    "planning",
    "waiting_for_user",
    "waiting_for_kyc",
    "waiting_for_funding",
    "waiting_for_approval",
    "executing",
    "completed",
    "cancelled",
    "expired",
    "failed"
  ]);

  function normalizeString(value) {
    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "string") {
      return value.trim();
    }

    if (
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return String(value).trim();
    }

    if (typeof value === "object") {
      return normalizeString(
        value.reply ||
          value.message ||
          value.text ||
          value.label ||
          value.content ||
          value.title ||
          value.prompt ||
          value.body ||
          ""
      );
    }

    return String(value).trim();
  }

  function normalizeLower(value) {
    return normalizeString(value)
      .toLowerCase();
  }

  function normalizeObject(value) {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return {};
    }

    return value;
  }

  function normalizeArray(value) {
    return Array.isArray(value)
      ? value
      : [];
  }

  function isInternalReplyText(value) {
    const text =
      normalizeLower(value);

    if (!text) {
      return true;
    }

    return INTERNAL_REPLY_TOKENS.has(text);
  }

  function pickFirstSafeText(...values) {
    for (const value of values) {
      const text =
        normalizeString(value);

      if (
        text &&
        !isInternalReplyText(text)
      ) {
        return text;
      }
    }

    return "";
  }

  function hasExplicitNoMessage(response = {}) {
    const data =
      normalizeObject(response);

    const plan =
      normalizeObject(data.plan);

    return (
      data.has_message === false ||
      data.hasMessage === false ||
      plan.has_message === false ||
      plan.hasMessage === false
    );
  }

  function pickReplyText(response = {}) {
    if (hasExplicitNoMessage(response)) {
      return "";
    }

    const data =
      normalizeObject(response);

    const plan =
      normalizeObject(data.plan);

    return pickFirstSafeText(
      data.message,
      data.reply,
      data.current_prompt,
      data.text,
      data.content,
      data.prompt,
      data.body,

      plan.message,
      plan.reply,
      plan.current_prompt,
      plan.text,
      plan.content,
      plan.prompt,
      plan.body
    );
  }

  function pickAgentPlanId(response = {}) {
    const data =
      normalizeObject(response);

    return normalizeString(
      data.agent_plan_id ||
        data.pay_agent_plan_id ||
        data.plan_id ||
        data.id ||
        data.plan?.agent_plan_id ||
        data.plan?.id
    );
  }

  function pickStatus(response = {}) {
    const data =
      normalizeObject(response);

    return normalizeLower(
      data.current_state ||
        data.status ||
        data.plan?.current_state ||
        data.plan?.status
    );
  }

  function pickSafeSummary(response = {}) {
    const data =
      normalizeObject(response);

    return normalizeObject(
      data.safe_plan_summary ||
        data.plan?.safe_plan_summary ||
        data.summary
    );
  }

  function pickNextAction(response = {}) {
    const data =
      normalizeObject(response);

    const direct =
      data.next_action ||
      data.plan?.next_action;

    if (typeof direct === "string") {
      return {
        type: direct
      };
    }

    if (
      direct &&
      typeof direct === "object" &&
      !Array.isArray(direct)
    ) {
      return normalizeObject(direct);
    }

    const actions =
      normalizeArray(
        data.actions ||
          data.plan?.actions
      );

    const firstAction =
      actions.find((action) => {
        const item =
          normalizeObject(action);

        return Boolean(
          item.type ||
            item.action
        );
      });

    return normalizeObject(firstAction);
  }

  function pickAvailableOptions(response = {}) {
    const data =
      normalizeObject(response);

    return normalizeArray(
      data.available_options ||
        data.options ||
        data.plan?.available_options
    );
  }

  function normalizeOptionId(option = {}) {
    if (typeof option === "string") {
      return normalizeLower(option);
    }

    const item =
      normalizeObject(option);

    return normalizeLower(
      item.id ||
        item.value ||
        item.method ||
        item.funding_method ||
        item.type ||
        item.action ||
        item.name
    );
  }

  function normalizeOptionLabel(option = {}) {
    if (typeof option === "string") {
      return normalizeString(option);
    }

    const item =
      normalizeObject(option);

    return normalizeString(
      item.label ||
        item.title ||
        item.name ||
        item.id ||
        item.value
    );
  }

  function normalizeOptionDescription(option = {}) {
    if (typeof option === "string") {
      return "";
    }

    const item =
      normalizeObject(option);

    return normalizeString(
      item.description ||
        item.subtitle ||
        item.help ||
        item.hint
    );
  }

  function pickNextActionType(response = {}) {
    const nextAction =
      pickNextAction(response);

    return normalizeLower(
      nextAction.type ||
        nextAction.action
    );
  }

  function pickNextActionLabel(response = {}) {
    const nextAction =
      pickNextAction(response);

    return pickFirstSafeText(
      nextAction.label,
      nextAction.title,
      pickNextActionType(response)
    );
  }

  function hasAvailableOptions(response = {}) {
    return pickAvailableOptions(response).length > 0;
  }

  function isReviewState(response = {}) {
    const status =
      pickStatus(response);

    const actionType =
      pickNextActionType(response);

    return (
      status === "review_required" ||
      actionType === "confirm_route"
    );
  }

  function isWalletFundingOption(option = {}) {
    return normalizeOptionId(option) === FUNDING_METHOD_IDS.wallet;
  }

  function isCardFundingOption(option = {}) {
    return normalizeOptionId(option) === FUNDING_METHOD_IDS.card;
  }

  function isBankTransferFundingOption(option = {}) {
    return normalizeOptionId(option) === FUNDING_METHOD_IDS.bankTransfer;
  }

  function isFundingMethodOption(option = {}) {
    return (
      isWalletFundingOption(option) ||
      isCardFundingOption(option) ||
      isBankTransferFundingOption(option)
    );
  }

  function isWalletNextAction(response = {}) {
    const actionType =
      pickNextActionType(response);

    return (
      actionType === "connect_wallet" ||
      actionType === "approve_wallet_payment"
    );
  }

  function buildActionMessageFromPayload(payload = {}) {
    const data =
      normalizeObject(payload);

    return pickFirstSafeText(
      data.option_id,
      data.selected_option,
      data.value,
      data.message,
      data.funding_method
    );
  }

  return {
    FUNDING_METHOD_IDS,

    normalizeString,
    normalizeLower,
    normalizeObject,
    normalizeArray,

    isInternalReplyText,
    pickFirstSafeText,

    pickReplyText,
    pickAgentPlanId,
    pickStatus,
    pickSafeSummary,
    pickNextAction,
    pickAvailableOptions,
    pickNextActionType,
    pickNextActionLabel,

    normalizeOptionId,
    normalizeOptionLabel,
    normalizeOptionDescription,

    hasAvailableOptions,
    isReviewState,
    isWalletFundingOption,
    isCardFundingOption,
    isBankTransferFundingOption,
    isFundingMethodOption,
    isWalletNextAction,

    buildActionMessageFromPayload
  };
})();
