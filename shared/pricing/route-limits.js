// shared/pricing/route-limits.js

const ROUTE_LIMIT_FAILURE_CODES =
  Object.freeze({
    belowMinimum:
      "route_amount_below_minimum",

    aboveMaximum:
      "route_amount_above_maximum"
  });

function isObject(value) {
  return Boolean(
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(value)
  );
}

function normalizeString(value) {
  return String(
    value ??
    ""
  ).trim();
}

function normalizeUpper(value) {
  return normalizeString(
    value
  ).toUpperCase();
}

function toFiniteNumber(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function formatAmount(value) {
  const amount =
    toFiniteNumber(value);

  if (amount === null) {
    return null;
  }

  return new Intl.NumberFormat(
    undefined,
    {
      maximumFractionDigits: 20
    }
  ).format(
    amount
  );
}

function resolveLimits(route) {
  return isObject(
    route?.route_limits
  )
    ? route.route_limits
    : null;
}

function resolveValidation(route) {
  return isObject(
    route
      ?.route_limit_validation
  )
    ? route
        .route_limit_validation
    : null;
}

/*
--------------------------------------------------
Route amount availability
--------------------------------------------------

The frontend does not know or care which executor produced
the Route.

The backend remains authoritative for:

- limit resolution
- amount semantics
- min/max values
- currency
- validation

A Route is amount-unavailable only when the backend
explicitly reports:

ok === false

Missing validation does not make the Route unavailable.

The checked field remains informational metadata only and
does not participate in the availability decision.
--------------------------------------------------
*/

export function isRouteAmountAvailable(
  route
) {
  const validation =
    resolveValidation(
      route
    );

  return (
    validation?.ok !== false
  );
}

/*
--------------------------------------------------
Route limit state
--------------------------------------------------

Expose one normalized generic state for all frontend
surfaces.

No executor, country, rail, or provider-specific logic is
allowed here.
--------------------------------------------------
*/

export function getRouteLimitState(
  route
) {
  const limits =
    resolveLimits(
      route
    );

  const validation =
    resolveValidation(
      route
    );

  const checked =
    validation?.checked ===
      true;

  const available =
    isRouteAmountAvailable(
      route
    );

  const code =
    normalizeString(
      validation?.code
    ) ||
    null;

  const currency =
    normalizeUpper(
      limits?.currency ??
      validation?.currency
    ) ||
    null;

  const minAmount =
    toFiniteNumber(
      limits?.min_amount ??
      validation?.min_amount
    );

  const maxAmount =
    toFiniteNumber(
      limits?.max_amount ??
      validation?.max_amount
    );

  return Object.freeze({
    available,
    checked,

    code,

    minAmount,
    maxAmount,
    currency,

    amountSemantics:
      normalizeString(
        limits
          ?.amount_semantics ??
        validation
          ?.amount_semantics
      ) ||
      null,

    source:
      limits?.source ??
      validation?.source ??
      null,

    limits,

    validation
  });
}

/*
--------------------------------------------------
Route limit message
--------------------------------------------------

Generate generic UX copy entirely from the canonical
backend-provided Route limit contract.

The message deliberately contains no executor-specific
knowledge.

When the backend identifies the constrained amount as the
recipient payout amount, the message makes that distinction
explicit so the user understands why the displayed limit
currency may differ from the source amount currency.
--------------------------------------------------
*/

export function formatRouteLimitMessage(
  route
) {
  const state =
    getRouteLimitState(
      route
    );

  if (state.available) {
    return null;
  }

  const minAmount =
    formatAmount(
      state.minAmount
    );

  const maxAmount =
    formatAmount(
      state.maxAmount
    );

  const currency =
    state.currency;

  const isPayoutAmount =
    state.amountSemantics ===
      "payout_amount";

  if (
    state.code ===
      ROUTE_LIMIT_FAILURE_CODES
        .belowMinimum &&
    minAmount &&
    currency
  ) {
    if (isPayoutAmount) {
      return (
        `Minimum payout is ` +
        `${minAmount} ${currency}. ` +
        `Increase the amount you send.`
      );
    }

    return (
      `Minimum amount is ` +
      `${minAmount} ${currency}`
    );
  }

  if (
    state.code ===
      ROUTE_LIMIT_FAILURE_CODES
        .aboveMaximum &&
    maxAmount &&
    currency
  ) {
    if (isPayoutAmount) {
      return (
        `Maximum payout is ` +
        `${maxAmount} ${currency}. ` +
        `Reduce the amount you send.`
      );
    }

    return (
      `Maximum amount is ` +
      `${maxAmount} ${currency}`
    );
  }

  if (
    minAmount &&
    maxAmount &&
    currency
  ) {
    if (isPayoutAmount) {
      return (
        `Payout must be between ` +
        `${minAmount} and ` +
        `${maxAmount} ${currency}.`
      );
    }

    return (
      `Available from ` +
      `${minAmount} to ` +
      `${maxAmount} ${currency}`
    );
  }

  return (
    normalizeString(
      state.validation?.message
    ) ||
    "Unavailable for this amount"
  );
}

/*
--------------------------------------------------
Route limit range message
--------------------------------------------------

Display the backend-provided Route limit range even when
the current amount is valid.

This helper reads only the canonical route_limits
contract. It does not inspect validation or contain any
executor-specific knowledge.
--------------------------------------------------
*/

export function formatRouteLimitRangeMessage(
  route
) {
  const limits =
    resolveLimits(
      route
    );

  const minAmount =
    formatAmount(
      limits?.min_amount
    );

  const maxAmount =
    formatAmount(
      limits?.max_amount
    );

  const currency =
    normalizeUpper(
      limits?.currency
    ) ||
    null;

  const amountSemantics =
    normalizeString(
      limits?.amount_semantics
    );

  if (
    !minAmount ||
    !maxAmount ||
    !currency
  ) {
    return null;
  }

  if (
    amountSemantics ===
      "payout_amount"
  ) {
    return (
      `Payout limits: ` +
      `${minAmount} – ` +
      `${maxAmount} ${currency}`
    );
  }

  return (
    `Amount limits: ` +
    `${minAmount} – ` +
    `${maxAmount} ${currency}`
  );
}

/*
--------------------------------------------------
First available Route
--------------------------------------------------

Preserve backend Route ordering.

The first Route that is not explicitly rejected by the
backend limit validation is selected.

This remains executor-agnostic and automatically supports
future executors using the same Route limit contract.
--------------------------------------------------
*/

export function selectFirstAvailableRoute(
  routes = []
) {
  if (!Array.isArray(routes)) {
    return null;
  }

  return (
    routes.find(
      isRouteAmountAvailable
    ) ??
    null
  );
}
