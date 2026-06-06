// fiat/bank-transfer/js/settlementResume.js

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeNumber(value) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function parseJsonObject(value) {
  if (!value) {
    return {};
  }

  if (typeof value === "object") {
    return value || {};
  }

  try {
    const parsed =
      JSON.parse(String(value));

    return parsed && typeof parsed === "object"
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function resolveTimestamp(value) {
  const directNumber =
    normalizeNumber(value);

  if (directNumber) {
    return directNumber;
  }

  const dateValue =
    Date.parse(
      normalizeString(value)
    );

  return Number.isFinite(dateValue)
    ? dateValue
    : null;
}

function resolveFiatContextStartedAt(fiatContext) {
  const context =
    parseJsonObject(
      fiatContext
    );

  return (
    resolveTimestamp(context.flow_started_at) ||
    resolveTimestamp(context.started_at) ||
    resolveTimestamp(context.created_at) ||
    resolveTimestamp(context.updated_at) ||
    null
  );
}

function resolveStateFiatContextStartedAt(state = {}) {
  return (
    resolveTimestamp(state.fiat_context_started_at) ||
    resolveTimestamp(state.fiat_context_created_at) ||
    resolveTimestamp(state.fiat_context_updated_at) ||
    null
  );
}

function isReturnedFromBridgeTos(query = {}) {
  return (
    query.tos_accepted === "1" ||
    query.tos_accepted === "true"
  );
}

function hasQuerySettlementId(query = {}) {
  return Boolean(
    normalizeString(
      query.settlement_id
    )
  );
}

function hasQueryBankVerifiedIdentityRef(query = {}) {
  return Boolean(
    normalizeString(
      query.bank_verified_identity_ref
    )
  );
}

function hasFreshFiatContext({
  state = {},
  fiatContext
} = {}) {
  const contextStartedAt =
    resolveFiatContextStartedAt(
      fiatContext
    );

  if (!contextStartedAt) {
    return false;
  }

  const stateContextStartedAt =
    resolveStateFiatContextStartedAt(
      state
    );

  if (!stateContextStartedAt) {
    return true;
  }

  return contextStartedAt > stateContextStartedAt;
}

export function shouldResumeSettlementAttempt({
  state = {},
  query = {}
} = {}) {
  return Boolean(
    isReturnedFromBridgeTos(query) ||
    hasQuerySettlementId(query) ||
    hasQueryBankVerifiedIdentityRef(query) ||
    state.tos_pending ||
    state.bridge_transfer_id ||
    state.bridge_transfer_state ||
    state.latest_funding_response
  );
}

export function resetStaleSettlementAttemptIfNeeded({
  state,
  query,
  fiatContext,
  defaultSourceRail
} = {}) {
  if (!state) {
    return {
      reset:
        false,
      reason:
        "missing_state"
    };
  }

  if (!state.settlement_id) {
    return {
      reset:
        false,
      reason:
        "no_existing_settlement"
    };
  }

  if (
    shouldResumeSettlementAttempt({
      state,
      query
    })
  ) {
    return {
      reset:
        false,
      reason:
        "resume_signal_present"
    };
  }

  const contextStartedAt =
    resolveFiatContextStartedAt(
      fiatContext
    );

  if (
    !hasFreshFiatContext({
      state,
      fiatContext
    })
  ) {
    return {
      reset:
        false,
      reason:
        "no_fresh_fiat_context"
    };
  }

  const preserved = {
    source_rail:
      normalizeString(
        state.source_rail
      ) ||
      normalizeString(
        defaultSourceRail
      ) ||
      null,

    source_country:
      normalizeString(
        state.source_country
      ) ||
      null,

    bank_customer_ref:
      normalizeString(
        state.bank_customer_ref
      ) ||
      null,

    bank_verified_identity_ref:
      normalizeString(
        state.bank_verified_identity_ref
      ) ||
      null,

    fiat_kyc_status:
      normalizeString(
        state.fiat_kyc_status
      ) ||
      null,

    fiat_context_started_at:
      contextStartedAt
  };

  Object.keys(state).forEach((key) => {
    delete state[key];
  });

  Object.assign(
    state,
    {
      ...preserved,

      settlement_id:
        null,

      settlement:
        null,

      prepared_quote:
        null,

      tos_pending:
        false,

      tos_accepted:
        false,

      tos_url:
        null,

      bridge_tos_status:
        null,

      bridge_customer_id:
        null,

      bridge_customer_status:
        null,

      bridge_customer_kyc_status:
        null,

      bridge_customer_tos_status:
        null,

      bridge_transfer_id:
        null,

      bridge_transfer_state:
        null,

      latest_funding_response:
        null
    }
  );

  return {
    reset:
      true,

    reason:
      "fresh_fiat_context_started",

    preserved
  };
}
