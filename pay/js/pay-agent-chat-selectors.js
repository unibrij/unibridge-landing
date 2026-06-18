// pay/js/pay-agent-chat-selectors.js

/*
--------------------------------------------------
Pay Agent Chat Selectors

Responsibility:
- Normalize backend responses.
- Pick safe UI fields from Pay Agent responses.
- Normalize options/actions for rendering.

Does not:
- Render DOM.
- Call backend APIs.
- Mutate storage.
- Decide payment flow.
- Mask private values.
--------------------------------------------------
*/

window.UnibridgePayAgentChatSelectors = (() => {
  const FUNDING_METHOD_IDS = {
    wallet:
      "wallet",

    card:
      "card",

    bankTransfer:
      "bank_transfer"
  };

  function normalizeString(value) {
    if (value === null || value === undefined) {
      return "";
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

  function pickReplyText(response = {}) {
    const data =
      normalizeObject(response);

    return normalizeString(
      data.reply ||
        data.current_prompt ||
        data.current_question ||
        data.message ||
        ""
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

    return normalizeString(
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

    const value =
      data.next_action ||
      data.plan?.next_action;

    if (typeof value === "string") {
      return {
        type:
          value
      };
    }

    return normalizeObject(value);
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

    return normalizeString(
      nextAction.label ||
        nextAction.title ||
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

    return normalizeString(
      data.message ||
        data.value ||
        data.funding_method ||
        data.option_id ||
        data.action
    );
  }

  return {
    FUNDING_METHOD_IDS,

    normalizeString,
    normalizeLower,
    normalizeObject,
    normalizeArray,

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
