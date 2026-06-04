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
    ...nextState,
    updated_at:
      new Date().toISOString()
  };

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(merged)
  );

  return merged;
}

export function clearStoredState() {
  window.localStorage.removeItem(
    STORAGE_KEY
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

  const bankCustomerRef =
    queryBankCustomerRef ||
    normalizeString(stored.bank_customer_ref) ||
    readOrCreateBankCustomerRef();

  writeBankCustomerRef(
    bankCustomerRef
  );

  return {
    ...defaults,
    ...stored,
    ...Object.fromEntries(
      Object.entries(query).filter(([, value]) => {
        return Boolean(value);
      })
    ),
    bank_customer_ref:
      bankCustomerRef
  };
}
