// fiat/bank-transfer/js/quoteRenderer.js

function normalizeString(value) {
  return String(value || "").trim();
}

function escapeHtml(value) {
  return normalizeString(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderQuoteValue(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return String(value);
}

export function renderQuote(container, {
  form,
  quote,
  selectedRoute
} = {}) {
  if (!container) {
    return;
  }

  const source =
    `${form.source_country} / ${form.source_rail}`;

  const destination =
    selectedRoute
      ? selectedRoute.label
      : form.receiver_country;

  const fundingAmount =
    renderQuoteValue(
      selectedRoute?.funding_amount ||
      quote?.requested_amount ||
      form.amount
    );

  const payoutAmount =
    renderQuoteValue(
      selectedRoute?.payout_amount ||
      quote?.payout_amount ||
      form.amount
    );

  container.innerHTML = `
    <div class="quote-header">
      <strong>Quote ready</strong>
      <span>Select a payout route and enter destination details.</span>
    </div>

    <div class="quote-grid">
      <div>
        <span>Source</span>
        <strong>${escapeHtml(source)}</strong>
      </div>

      <div>
        <span>Destination</span>
        <strong>${escapeHtml(destination)}</strong>
      </div>

      <div>
        <span>Funding amount</span>
        <strong>${escapeHtml(fundingAmount)}</strong>
      </div>

      <div>
        <span>Estimated payout</span>
        <strong>${escapeHtml(payoutAmount)}</strong>
      </div>
    </div>
  `;

  container.classList.remove("hidden");
}
