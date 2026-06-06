// fiat/bank-transfer/js/settlementResume.js

function normalizeString(value) {
  return String(value || "").trim();
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
  hasFiatContext,
  defaultSourceRail
} = {}) {
  if (!state) {
    return {
      reset:
        false
    };
  }

  if (!hasFiatContext) {
    return {
      reset:
        false
    };
  }

  if (!state.settlement_id) {
    return {
      reset:
        false
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
        false
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
      null
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

    preserved
  };
}
