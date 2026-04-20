// unibridge-landing/surface/public/ui-helpers.js

export function formatNumber(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return "—";
  }

  if (Number.isInteger(n)) {
    return String(n);
  }

  return n.toFixed(2).replace(/\.00$/, "");
}

export function setTextIfPresent(id, value) {
  const el = document.getElementById(id);

  if (el) {
    el.innerText = value;
  }
}

export function setDisplayIfPresent(id, displayValue) {
  const el = document.getElementById(id);

  if (el) {
    el.style.display = displayValue;
  }
}

export function renderExecutionQuote({
  requestedAmount,
  countryLabel,
  executorFee,
  setStatus
}) {
  setTextIfPresent("sumAmount", formatNumber(requestedAmount));
  setTextIfPresent("sumCountry", countryLabel || "Brazil");

  const normalizedExecutorFee = Number(executorFee ?? 0);

  if (Number.isFinite(normalizedExecutorFee)) {
    setTextIfPresent(
      "sumExecutorFee",
      formatNumber(normalizedExecutorFee)
    );
    setDisplayIfPresent("executorFeeRow", "block");
  } else {
    setDisplayIfPresent("executorFeeRow", "none");
  }

  const executorFeeRow =
    document.getElementById("executorFeeRow");

  if (!executorFeeRow && typeof setStatus === "function") {
    const parts = [
      `Amount: ${formatNumber(requestedAmount)}`
    ];

    if (Number.isFinite(normalizedExecutorFee)) {
      parts.push(
        `Execution fee: ${formatNumber(normalizedExecutorFee)}`
      );
    }

    setStatus(parts.join("\n"));
  }
}
