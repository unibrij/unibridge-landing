// fiat/bank-transfer/js/state.js

const STORAGE_KEY =
  "unibridge_bank_transfer_flow";

const CUSTOMER_REF_KEY =
  "unibridge_fiat_bank_customer_ref";

function normalizeString(value) {
  return String(value || "").trim();
}

function safeRandomId(prefix) {
  if (window.crypto?.randomUUID) {
    return `${prefix}_${window.crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeStateObject(value = {}) {
  return value && typeof value === "object"
    ? value
    : {};
}

export function readOrCreateBankCustomerRef() {
  const existing =
    normalizeString(
      window.localStorage.getItem(
        CUSTOMER_REF_KEY
      )
    );

  if (existing) {
    return existing;
  }

  const next =
    safeRandomId("fbc");

  window.localStorage.setItem(
    CUSTOMER_REF_KEY,
    next
  );

  return next;
}

export function createNewBankCustomerRef() {
  const next =
    safeRandomId("fbc");

  window.localStorage.setItem(
    CUSTOMER_REF_KEY,
    next
  );

  return next;
}

export function readBankCustomerRef() {
  return normalizeString(
    window.localStorage.getItem(
      CUSTOMER_REF_KEY
    )
  );
}

export function writeBankCustomerRef(value) {
  const ref =
    normalizeString(value);

  if (!ref) {
    return null;
  }

  window.localStorage.setItem(
    CUSTOMER_REF_KEY,
    ref
  );

  return ref;
}

export function clearRouteDraftState() {
  window.localStorage.removeItem(
    STORAGE_KEY
  );
}

export function clearBankCustomerRef() {
  window.localStorage.removeItem(
    CUSTOMER_REF_KEY
  );
}

export function readQueryParams() {
  const params =
    new URLSearchParams(window.location.search);

  return {
    settlement_id:
      normalizeString(
        params.get("settlement_id")
      ),

    bank_customer_ref:
      normalizeString(
        params.get("bank_customer_ref")
      ),

    bank_verified_identity_ref:
      normalizeString(
        params.get("bank_verified_identity_ref")
      ),

    tos_accepted:
      normalizeString(
        params.get("tos_accepted")
      ),

    email:
      normalizeString(
        params.get("email")
      ),

    phone:
      normalizeString(
        params.get("phone")
      ),

    source_country:
      normalizeString(
        params.get("source_country")
      ),

    source_rail:
      normalizeString(
        params.get("source_rail")
      )
  };
}

export function readStoredState() {
  try {
    const raw =
      window.localStorage.getItem(
        STORAGE_KEY
      );

    if (!raw) {
      return {};
    }

    const parsed =
      JSON.parse(raw);

    return parsed && typeof parsed === "object"
      ? parsed
      : {};
  } catch {
    return {};
  }
}

export function writeStoredState(nextState = {}) {
  const current =
    readStoredState();

  const merged = {
    ...current,
    ...normalizeStateObject(nextState),

    updated_at:
      nowIso()
  };

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(merged)
  );

  return merged;
}

export function replaceStoredState(nextState = {}) {
  const normalized =
    normalizeStateObject(
      nextState
    );

  const payload = {
    ...normalized,

    updated_at:
      nowIso()
  };

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(payload)
  );

  return payload;
}

export function clearStoredState() {
  window.localStorage.removeItem(
    STORAGE_KEY
  );
}

function pickQueryValues(query = {}) {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => {
      return Boolean(value);
    })
  );
}

export function resolveStoredAuthSubjectId(state = {}) {
  return (
    normalizeString(
      state.auth_subject_id
    ) ||
    normalizeString(
      state.user_id
    ) ||
    null
  );
}

export function resolveAuthSubjectId(auth = {}) {
  return (
    normalizeString(
      auth.auth_subject_id
    ) ||
    normalizeString(
      auth.user_id
    ) ||
    null
  );
}

export function writeAuthOwnerToState({
  auth_subject_id,
  user_id,
  email,
  auth_provider = "clerk"
} = {}) {
  const subjectId =
    normalizeString(
      auth_subject_id ||
      user_id
    );

  const normalizedEmail =
    normalizeString(email);

  if (!subjectId) {
    return readStoredState();
  }

  return writeStoredState({
    auth_provider,

    auth_subject_id:
      subjectId,

    user_id:
      subjectId,

    ...(normalizedEmail
      ? {
          auth_email:
            normalizedEmail,

          email:
            normalizedEmail
        }
      : {})
  });
}

export function isDifferentAuthSubject({
  state,
  auth
} = {}) {
  const storedSubjectId =
    resolveStoredAuthSubjectId(
      state
    );

  const currentSubjectId =
    resolveAuthSubjectId(
      auth
    );

  return Boolean(
    storedSubjectId &&
    currentSubjectId &&
    storedSubjectId !== currentSubjectId
  );
}

/*
--------------------------------------------------
Light reset:
Same Clerk user wants to change amount / route
or start a new payout attempt.

Keep:
- auth owner
- bank_customer_ref
- KYC/customer reusable identity

Clear:
- quote
- settlement
- transfer/funding attempt
- ToS attempt state
--------------------------------------------------
*/
export function resetSettlementAttemptForSameUser({
  state = {},
  defaults = {}
} = {}) {
  const current =
    normalizeStateObject(
      state
    );

  const bankCustomerRef =
    normalizeString(
      current.bank_customer_ref
    ) ||
    readBankCustomerRef() ||
    readOrCreateBankCustomerRef();

  writeBankCustomerRef(
    bankCustomerRef
  );

  const next = {
    ...defaults,

    auth_provider:
      current.auth_provider || "clerk",

    auth_subject_id:
      normalizeString(
        current.auth_subject_id
      ) || null,

    user_id:
      normalizeString(
        current.user_id ||
        current.auth_subject_id
      ) || null,

    auth_email:
      normalizeString(
        current.auth_email ||
        current.email
      ) || null,

    email:
      normalizeString(
        current.email ||
        current.auth_email
      ) || null,

    bank_customer_ref:
      bankCustomerRef,

    source_country:
      current.source_country || defaults.source_country,

    source_rail:
      current.source_rail || defaults.source_rail,

    reset_reason:
      "same_user_new_settlement_attempt",

    reset_at:
      nowIso()
  };

  return replaceStoredState(
    next
  );
}

/*
--------------------------------------------------
Full reset:
Clerk user changed.

Do NOT keep:
- old bank_customer_ref
- old verified identity
- old settlement
- old transfer
- old customer refs bound to prior user

Create:
- new bank_customer_ref for new Clerk subject
--------------------------------------------------
*/
export function resetFlowForDifferentUser({
  auth = {},
  defaults = {}
} = {}) {
  clearStoredState();

  clearBankCustomerRef();

  const bankCustomerRef =
    createNewBankCustomerRef();

  const subjectId =
    resolveAuthSubjectId(
      auth
    );

  const email =
    normalizeString(
      auth.email
    );

  const next = {
    ...defaults,

    auth_provider:
      "clerk",

    auth_subject_id:
      subjectId,

    user_id:
      subjectId,

    ...(email
      ? {
          auth_email:
            email,

          email
        }
      : {}),

    bank_customer_ref:
      bankCustomerRef,

    reset_reason:
      "different_clerk_user",

    reset_at:
      nowIso()
  };

  return replaceStoredState(
    next
  );
}

export function resolveInitialState(defaults = {}) {
  const stored =
    readStoredState();

  const query =
    readQueryParams();

  const queryBankCustomerRef =
    normalizeString(
      query.bank_customer_ref
    );

  const storedBankCustomerRef =
    normalizeString(
      stored.bank_customer_ref
    );

  const localBankCustomerRef =
    readBankCustomerRef();

  const bankCustomerRef =
    queryBankCustomerRef ||
    storedBankCustomerRef ||
    localBankCustomerRef ||
    readOrCreateBankCustomerRef();

  writeBankCustomerRef(
    bankCustomerRef
  );

  return {
    ...defaults,
    ...stored,
    ...pickQueryValues(query),

    bank_customer_ref:
      bankCustomerRef
  };
}
