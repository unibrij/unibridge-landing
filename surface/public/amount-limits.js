// unibrij/unibridge-landing/surface/public/amount-limits.js

const SOURCE_COUNTRY_LIMITS = Object.freeze({
  AE: { min: 50, max: 1000, currency: "AED" },
  EU: { min: 10, max: 1000, currency: "EUR" },
  GB: { min: 9, max: 1000, currency: "GBP" },
  UK: { min: 9, max: 1000, currency: "GBP" }
});

const RAMP_LIMITS = Object.freeze({
  onramp: {
    AE: { min: 50, max: 1000, currency: "AED" },
    EU: { min: 10, max: 1000, currency: "EUR" },
    GB: { min: 9, max: 1000, currency: "GBP" },
    UK: { min: 9, max: 1000, currency: "GBP" }
  },

  guardarian: {
    EU: { min: 17, max: 1000, currency: "EUR" },
    DEFAULT: { min: 17, max: 1000, currency: "EUR" }
  },

  transak: {
    DEFAULT: { min: 5, max: 1000, currency: "USD" }
  }
});

function normalizeProvider(value) {
  return String(value || "")
    .toLowerCase()
    .trim();
}

function normalizeCountry(value) {
  return String(value || "")
    .toUpperCase()
    .trim();
}

function getLimits({ provider, country }) {
  const normalizedProvider = normalizeProvider(provider);
  const normalizedCountry = normalizeCountry(country);

  const providerConfig = RAMP_LIMITS[normalizedProvider];

  if (providerConfig) {
    return (
      providerConfig[normalizedCountry] ||
      providerConfig.DEFAULT ||
      SOURCE_COUNTRY_LIMITS[normalizedCountry] ||
      null
    );
  }

  /*
  --------------------------------------------------
  Pre-quote fallback
  --------------------------------------------------
  Before quote, selected provider may still be null.
  Enforce source-country limits before allowing route quote.
  --------------------------------------------------
  */

  return (
    SOURCE_COUNTRY_LIMITS[normalizedCountry] ||
    null
  );
}

function formatLimitValue(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) return "—";
  if (Number.isInteger(n)) return String(n);

  return n.toFixed(2).replace(/\.00$/, "");
}

export function validateAmountLimits({
  provider,
  country,
  amount
}) {
  const limits = getLimits({ provider, country });

  if (!limits) {
    return {
      ok: true,
      reason: null,
      message: "",
      limits: null
    };
  }

  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return {
      ok: false,
      reason: "invalid_amount",
      message: `Enter an amount between ${formatLimitValue(limits.min)} and ${formatLimitValue(limits.max)} ${limits.currency}.`,
      limits
    };
  }

  if (numericAmount < limits.min) {
    return {
      ok: false,
      reason: "below_min",
      message: `Minimum amount is ${formatLimitValue(limits.min)} ${limits.currency}. Maximum is ${formatLimitValue(limits.max)} ${limits.currency}.`,
      limits
    };
  }

  if (numericAmount > limits.max) {
    return {
      ok: false,
      reason: "above_max",
      message: `Maximum amount is ${formatLimitValue(limits.max)} ${limits.currency}. Minimum is ${formatLimitValue(limits.min)} ${limits.currency}.`,
      limits
    };
  }

  return {
    ok: true,
    reason: null,
    message: "",
    limits
  };
}

export function applyAmountLimitUi({
  amountInput,
  messageEl,
  continueBtn,
  provider,
  country
}) {
  if (!amountInput) {
    return {
      ok: true,
      reason: "missing_amount_input",
      message: "",
      limits: null
    };
  }

  const result = validateAmountLimits({
    provider,
    country,
    amount: amountInput.value
  });

  if (!result.ok) {
    amountInput.style.borderColor = "#dc2626";
    amountInput.style.outlineColor = "#dc2626";

    if (messageEl) {
      messageEl.innerText = result.message;
      messageEl.style.display = "block";
      messageEl.style.color = "#dc2626";
    }

    if (continueBtn) {
      continueBtn.disabled = true;
    }

    return result;
  }

  amountInput.style.borderColor = "";
  amountInput.style.outlineColor = "";

  if (messageEl) {
    messageEl.innerText = "";
    messageEl.style.display = "none";
  }

  if (continueBtn) {
    continueBtn.disabled = false;
  }

  return result;
}
