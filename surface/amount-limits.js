// unibrij/unibridge-landing/surface/amount-limits.js

const SOURCE_COUNTRY_LIMITS =
  Object.freeze({
    AE: Object.freeze({
      min: 50,
      max: 370000,
      currency: "AED"
    }),

    EU: Object.freeze({
      min: 10,
      currency: "EUR"
    }),

    GB: Object.freeze({
      min: 9,
      currency: "GBP"
    }),

    UK: Object.freeze({
      min: 9,
      currency: "GBP"
    })
  });

const RAMP_LIMITS =
  Object.freeze({
    onramp: Object.freeze({
      AE: Object.freeze({
        min: 50,
        max: 370000,
        currency: "AED"
      }),

      EU: Object.freeze({
        min: 10,
        currency: "EUR"
      }),

      GB: Object.freeze({
        min: 9,
        currency: "GBP"
      }),

      UK: Object.freeze({
        min: 9,
        currency: "GBP"
      })
    })
  });


function normalizeProvider(
  value
) {
  return String(
    value ||
    ""
  )
    .toLowerCase()
    .trim();
}


function normalizeCountry(
  value
) {
  return String(
    value ||
    ""
  )
    .toUpperCase()
    .trim();
}


function getLimits({
  provider,
  country
}) {
  const normalizedProvider =
    normalizeProvider(
      provider
    );

  const normalizedCountry =
    normalizeCountry(
      country
    );

  /*
  --------------------------------------------------
  Pre-quote fallback

  Before quote, the backend has not selected a funding
  provider yet.

  Apply only the known Surface source-country limits.
  --------------------------------------------------
  */

  if (!normalizedProvider) {
    return (
      SOURCE_COUNTRY_LIMITS[
        normalizedCountry
      ] ||
      null
    );
  }

  /*
  --------------------------------------------------
  Backend-selected provider

  The Surface does not choose or infer the provider.

  Once quote resolution selects the funding provider,
  apply only that provider's known limits.

  Unknown providers intentionally receive no local
  funding-limit assumption.
  --------------------------------------------------
  */

  const providerConfig =
    RAMP_LIMITS[
      normalizedProvider
    ];

  if (!providerConfig) {
    return null;
  }

  return (
    providerConfig[
      normalizedCountry
    ] ||
    providerConfig.DEFAULT ||
    null
  );
}


function toFiniteNumber(
  value
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(
      value
    );

  return Number.isFinite(
    number
  )
    ? number
    : null;
}


function formatLimitValue(
  value
) {
  const number =
    toFiniteNumber(
      value
    );

  if (number === null) {
    return null;
  }

  return new Intl.NumberFormat(
    undefined,
    {
      maximumFractionDigits: 20
    }
  ).format(
    number
  );
}


function buildAllowedRangeMessage(
  limits = {}
) {
  const min =
    formatLimitValue(
      limits.min
    );

  const max =
    formatLimitValue(
      limits.max
    );

  const currency =
    String(
      limits.currency ||
      ""
    ).trim();

  if (
    min &&
    max &&
    currency
  ) {
    return (
      `Enter an amount between ` +
      `${min} and ${max} ${currency}.`
    );
  }

  if (
    min &&
    currency
  ) {
    return (
      `Enter an amount of at least ` +
      `${min} ${currency}.`
    );
  }

  if (
    max &&
    currency
  ) {
    return (
      `Enter an amount up to ` +
      `${max} ${currency}.`
    );
  }

  return "Enter a valid amount.";
}


export function validateAmountLimits({
  provider,
  country,
  amount
}) {
  const limits =
    getLimits({
      provider,
      country
    });

  if (!limits) {
    return {
      ok: true,
      reason: null,
      message: "",
      limits: null
    };
  }

  const numericAmount =
    Number(
      amount
    );

  const min =
    toFiniteNumber(
      limits.min
    );

  const max =
    toFiniteNumber(
      limits.max
    );

  const currency =
    String(
      limits.currency ||
      ""
    ).trim();

  if (
    !Number.isFinite(
      numericAmount
    ) ||
    numericAmount <= 0
  ) {
    return {
      ok: false,

      reason:
        "invalid_amount",

      message:
        buildAllowedRangeMessage(
          limits
        ),

      limits
    };
  }

  if (
    min !== null &&
    numericAmount < min
  ) {
    const formattedMin =
      formatLimitValue(
        min
      );

    const formattedMax =
      formatLimitValue(
        max
      );

    return {
      ok: false,

      reason:
        "below_min",

      message:
        formattedMax
          ? (
              `Minimum amount is ` +
              `${formattedMin} ${currency}. ` +
              `Maximum is ` +
              `${formattedMax} ${currency}.`
            )
          : (
              `Minimum amount is ` +
              `${formattedMin} ${currency}.`
            ),

      limits
    };
  }

  if (
    max !== null &&
    numericAmount > max
  ) {
    const formattedMin =
      formatLimitValue(
        min
      );

    const formattedMax =
      formatLimitValue(
        max
      );

    return {
      ok: false,

      reason:
        "above_max",

      message:
        formattedMin
          ? (
              `Maximum amount is ` +
              `${formattedMax} ${currency}. ` +
              `Minimum is ` +
              `${formattedMin} ${currency}.`
            )
          : (
              `Maximum amount is ` +
              `${formattedMax} ${currency}.`
            ),

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

      reason:
        "missing_amount_input",

      message:
        "",

      limits:
        null
    };
  }

  const result =
    validateAmountLimits({
      provider,
      country,

      amount:
        amountInput.value
    });

  if (!result.ok) {
    amountInput.style.borderColor =
      "#dc2626";

    amountInput.style.outlineColor =
      "#dc2626";

    if (messageEl) {
      messageEl.innerText =
        result.message;

      messageEl.style.display =
        "block";

      messageEl.style.color =
        "#dc2626";
    }

    if (continueBtn) {
      continueBtn.disabled =
        true;
    }

    return result;
  }

  amountInput.style.borderColor =
    "";

  amountInput.style.outlineColor =
    "";

  if (messageEl) {
    messageEl.innerText =
      "";

    messageEl.style.display =
      "none";
  }

  if (continueBtn) {
    continueBtn.disabled =
      false;
  }

  return result;
}
