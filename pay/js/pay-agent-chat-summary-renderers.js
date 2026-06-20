// pay/js/pay-agent-chat-summary-renderers.js

window.UnibridgePayAgentChatSummaryRenderers = (() => {
  const Core =
    window.UnibridgePayAgentChatRendererCore;

  if (!Core) {
    throw new Error("Pay Agent renderer core is not loaded.");
  }

  function buildDestinationSummary(destination = {}) {
    const item =
      Core.normalizeObject(destination);

    return Core.normalizeString(
      item.label ||
        [
          item.country_name,
          item.payout_rail
        ]
          .filter(Boolean)
          .join(" · ")
    );
  }

  function buildAmountSummary(summary = {}) {
    const item =
      Core.normalizeObject(summary);

    return Core.normalizeString(
      [
        item.amount,
        item.amount_currency
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  function buildRecipientSummary(beneficiary = {}) {
    const item =
      Core.normalizeObject(beneficiary);

    if (item.fields_total === undefined) {
      return "";
    }

    const collected =
      Core.normalizeArray(
        item.fields_collected
      ).length;

    return `${collected}/${item.fields_total} fields added`;
  }

  function renderSafeSummary(response = {}) {
    const Dom =
      Core.getDom();

    const Selectors =
      Core.getSelectors();

    if (!Dom || !Selectors) {
      return null;
    }

    if (!Selectors.isReviewState(response)) {
      return null;
    }

    const summary =
      Selectors.pickSafeSummary(response);

    if (!Object.keys(summary).length) {
      return null;
    }

    const card =
      Core.createElement(
        "div",
        "pay-agent-info-panel"
      );

    card.appendChild(
      Core.createElement(
        "div",
        "pay-agent-info-panel-title",
        "Review payment"
      )
    );

    Core.appendSummaryRow(
      card,
      "Destination",
      buildDestinationSummary(
        summary.destination
      )
    );

    Core.appendSummaryRow(
      card,
      "Amount",
      buildAmountSummary(summary)
    );

    Core.appendSummaryRow(
      card,
      "Funding",
      summary.selected_funding_method ||
        summary.funding_type
    );

    Core.appendSummaryRow(
      card,
      "Asset",
      summary.asset
    );

    Core.appendSummaryRow(
      card,
      "Currency",
      summary.fiat_currency
    );

    Core.appendSummaryRow(
      card,
      "Recipient",
      buildRecipientSummary(
        summary.beneficiary
      )
    );

    Dom.appendToMessages(
      card
    );

    return card;
  }

  return {
    renderSafeSummary,

    buildDestinationSummary,
    buildAmountSummary,
    buildRecipientSummary
  };
})();
