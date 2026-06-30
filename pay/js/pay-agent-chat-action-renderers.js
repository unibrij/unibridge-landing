// pay/js/pay-agent-chat-action-renderers.js

window.UnibridgePayAgentChatActionRenderers = (() => {
  const Core =
    window.UnibridgePayAgentChatRendererCore;

  if (!Core) {
    throw new Error("Pay Agent renderer core is not loaded.");
  }

  const HIDDEN_NEXT_ACTION_TYPES =
    new Set([
      "ask_language",
      "ask_destination",
      "ask_funding_type",
      "ask_stablecoin_asset",
      "ask_fiat_currency",
      "ask_amount",
      "ask_beneficiary",
      "needs_clarification"
    ]);

  const NEXT_ACTION_FIRST_STATUSES =
    new Set([
      "card_checkout_required",
      "bank_transfer_instructions_ready",
      "wallet_connect_required",
      "wallet_approval_required",
      "handoff_required"
    ]);

  function createActionButton(label, onClick, options = {}) {
    const safeLabel =
      Core.normalizeString(label);

    if (!safeLabel) {
      return null;
    }

    const button =
      Core.createElement(
        "button",
        options.secondary
          ? "pay-agent-action-button pay-agent-action-secondary"
          : "pay-agent-action-button",
        ""
      );

    button.type =
      "button";

    button.appendChild(
      Core.createElement(
        "span",
        "pay-agent-action-label",
        safeLabel
      )
    );

    const description =
      Core.normalizeString(
        options.description
      );

    if (description) {
      button.appendChild(
        Core.createElement(
          "span",
          "pay-agent-action-meta",
          description
        )
      );
    }

    if (typeof onClick === "function") {
      button.addEventListener(
        "click",
        onClick
      );
    }

    return button;
  }

  function getApi() {
    return window.UnibridgePayAgentApi || null;
  }

  function normalizeCoinsPhOptionsPayload(payload = {}) {
    const Selectors =
      Core.getSelectors();

    const data =
      Selectors?.normalizeObject?.(payload) || {};

    return Selectors?.normalizeArray?.(
      data.options ||
        data.channels ||
        data.data?.options ||
        data.data?.channels ||
        data.result?.options ||
        data.result?.channels
    ) || [];
  }

  function getInstitutionOptionLabel(option = {}) {
    const Selectors =
      Core.getSelectors();

    const item =
      Selectors.normalizeObject(option);

    return Selectors.pickFirstSafeText(
      item.label,
      item.name,
      item.channelName,
      item.transactionChannel,
      item.id
    );
  }

  function getInstitutionOptionDescription(option = {}) {
    const Selectors =
      Core.getSelectors();

    const item =
      Selectors.normalizeObject(option);

    return Selectors.pickFirstSafeText(
      item.channelSubject,
      item.transactionSubject,
      item.subject,
      item.id
    );
  }

  function getInstitutionOptionId(option = {}) {
    const Selectors =
      Core.getSelectors();

    const item =
      Selectors.normalizeObject(option);

    return Selectors.normalizeString(
      item.id ||
        item.value ||
        item.key ||
        item.channelSubject ||
        item.transactionSubject
    );
  }

  function buildControlledInstitutionPayload({
    response = {},
    option = {}
  } = {}) {
    const Selectors =
      Core.getSelectors();

    const field =
      Selectors.pickCurrentField(response);

    return {
      action:
        "select_controlled_option",

      controlled_field:
        Selectors.normalizeString(
          field.key ||
            field.name ||
            "recipient_institution"
        ),

      selected_option_id:
        getInstitutionOptionId(option)
    };
  }

  function renderInstitutionSearch(
    response = {},
    handlers = {}
  ) {
    const Dom =
      Core.getDom();

    const Selectors =
      Core.getSelectors();

    const Api =
      getApi();

    if (!Dom || !Selectors || !Api?.getCoinsPhPayoutChannels) {
      return false;
    }

    if (!Selectors.isInstitutionSearchUi(response)) {
      return false;
    }

    const wrapper =
      Core.createElement(
        "div",
        "pay-agent-option-group pay-agent-institution-search"
      );

    const input =
      Core.createElement(
        "input",
        "pay-agent-input pay-agent-institution-search-input"
      );

    const ui =
      Selectors.pickCurrentUi(response);

    input.type =
      "search";

    input.placeholder =
      Selectors.normalizeString(ui.placeholder) ||
      "Search bank or wallet";

    const results =
      Core.createElement(
        "div",
        "pay-agent-institution-results"
      );

    wrapper.appendChild(input);
    wrapper.appendChild(results);
    Dom.appendToActions(wrapper);

    let options = [];
    let loading = false;

    function renderResults(query = "") {
      results.innerHTML = "";

      const normalizedQuery =
        Selectors.normalizeLower(query);

      const minQueryLength =
        Number(ui.min_query_length || 2);

      if (
        normalizedQuery.length < minQueryLength
      ) {
        results.appendChild(
          Core.createElement(
            "div",
            "pay-agent-action-meta",
            `Type at least ${minQueryLength} characters.`
          )
        );
        return;
      }

      const maxResults =
        Number(ui.max_results || 5);

      const filtered =
        options
          .filter((option) => {
            const label =
              Selectors.normalizeLower(
                getInstitutionOptionLabel(option)
              );

            const description =
              Selectors.normalizeLower(
                getInstitutionOptionDescription(option)
              );

            return (
              label.includes(normalizedQuery) ||
              description.includes(normalizedQuery)
            );
          })
          .slice(0, maxResults);

      if (!filtered.length) {
        results.appendChild(
          Core.createElement(
            "div",
            "pay-agent-action-meta",
            "No matching institution found."
          )
        );
        return;
      }

      filtered.forEach((option) => {
        const label =
          getInstitutionOptionLabel(option);

        const button =
          createActionButton(
            label,
            () => {
              handlers.onOption?.({
                id:
                  getInstitutionOptionId(option),

                label,

                action:
                  "select_controlled_option",

                payload:
                  buildControlledInstitutionPayload({
                    response,
                    option
                  })
              });
            },
            {
              description:
                getInstitutionOptionDescription(option),
              secondary:
                true
            }
          );

        if (button) {
          results.appendChild(button);
        }
      });
    }

    async function loadOptions() {
      if (loading || options.length) {
        return;
      }

      loading = true;

      results.innerHTML = "";
      results.appendChild(
        Core.createElement(
          "div",
          "pay-agent-action-meta",
          "Loading institutions..."
        )
      );

      try {
        const payload =
          await Api.getCoinsPhPayoutChannels();

        options =
          normalizeCoinsPhOptionsPayload(payload);

        renderResults(input.value);
      } catch {
        results.innerHTML = "";
        results.appendChild(
          Core.createElement(
            "div",
            "pay-agent-action-meta",
            "Unable to load institutions."
          )
        );
      } finally {
        loading = false;
      }
    }

    input.addEventListener(
      "input",
      () => {
        loadOptions().then(() => {
          renderResults(input.value);
        });
      }
    );

    input.addEventListener(
      "focus",
      () => {
        loadOptions();
      }
    );

    setTimeout(() => {
      input.focus();
      loadOptions();
    }, 0);

    return true;
  }

  function shouldRenderAvailableOptions(response = {}) {
    const Selectors =
      Core.getSelectors();

    if (!Selectors) {
      return false;
    }

    const status =
      Selectors.pickStatus(response);

    if (
      status === "language_required" ||
      status === "destination_required" ||
      status === "amount_required" ||
      status === "beneficiary_required"
    ) {
      return false;
    }

    if (NEXT_ACTION_FIRST_STATUSES.has(status)) {
      return false;
    }

    return Selectors.hasAvailableOptions(response);
  }

  function renderAvailableOptions(
    response = {},
    handlers = {}
  ) {
    const Dom =
      Core.getDom();

    const Selectors =
      Core.getSelectors();

    if (!Dom || !Selectors) {
      return false;
    }

    const options =
      Selectors.pickAvailableOptions(response);

    if (!options.length) {
      return false;
    }

    const group =
      Core.createElement(
        "div",
        "pay-agent-option-group"
      );

    options.forEach((option) => {
      const label =
        Selectors.normalizeOptionLabel(option);

      if (!label) {
        return;
      }

      const button =
        createActionButton(
          label,
          () => {
            handlers.onOption?.(
              option
            );
          },
          {
            description:
              Selectors.normalizeOptionDescription(option),
            secondary:
              true
          }
        );

      if (button) {
        group.appendChild(button);
      }
    });

    if (!group.childNodes.length) {
      return false;
    }

    Dom.appendToActions(group);

    return true;
  }

  function shouldRenderNextAction(response = {}) {
    const Selectors =
      Core.getSelectors();

    if (!Selectors) {
      return false;
    }

    const actionType =
      Selectors.pickNextActionType(response);

    return Boolean(
      actionType &&
        !HIDDEN_NEXT_ACTION_TYPES.has(actionType)
    );
  }

  function renderNextAction(
    response = {},
    handlers = {}
  ) {
    const Dom =
      Core.getDom();

    const Selectors =
      Core.getSelectors();

    if (!Dom || !Selectors) {
      return false;
    }

    if (!shouldRenderNextAction(response)) {
      return false;
    }

    const nextAction =
      Selectors.pickNextAction(response);

    const label =
      Selectors.pickNextActionLabel(response);

    if (!label) {
      return false;
    }

    const button =
      createActionButton(
        label,
        () => {
          handlers.onNextAction?.(
            nextAction
          );
        }
      );

    if (!button) {
      return false;
    }

    Dom.appendToActions(button);

    return true;
  }

  function renderActions(
    response = {},
    handlers = {}
  ) {
    const Dom =
      Core.getDom();

    const Selectors =
      Core.getSelectors();

    if (!Dom || !Selectors) {
      return;
    }

    Dom.clearActions();

    if (renderInstitutionSearch(response, handlers)) {
      return;
    }

    const status =
      Selectors.pickStatus(response);

    if (
      NEXT_ACTION_FIRST_STATUSES.has(status) &&
      shouldRenderNextAction(response)
    ) {
      renderNextAction(response, handlers);
      return;
    }

    if (shouldRenderAvailableOptions(response)) {
      renderAvailableOptions(response, handlers);
      return;
    }

    if (shouldRenderNextAction(response)) {
      renderNextAction(response, handlers);
    }
  }

  function clearActions() {
    Core.getDom()?.clearActions?.();
  }

  return {
    createActionButton,

    renderAvailableOptions,
    renderNextAction,
    renderActions,

    shouldRenderAvailableOptions,
    shouldRenderNextAction,

    clearActions
  };
})();
