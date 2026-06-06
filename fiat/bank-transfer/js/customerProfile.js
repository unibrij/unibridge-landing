// fiat/bank-transfer/js/customerProfile.js

const FIAT_CUSTOMER_PROFILE_KEY =
  "unibridge_fiat_customer_profile";

const BRIDGE_PROFILE_DEFAULTS = {
  customer_region:
    "international",

  employment_status:
    "employed",

  expected_monthly_payments:
    "5000_9999",

  acting_as_intermediary:
    "no",

  most_recent_occupation:
    "291291",

  account_purpose:
    "purchase_goods_and_services",

  source_of_funds:
    "salary",

  identification_type:
    "national_id",

  issuing_country:
    "BRA"
};

function normalizeString(value) {
  return String(value || "").trim();
}

function getEl(id) {
  return document.getElementById(id);
}

function show(el) {
  el?.classList.remove("hidden");
}

function hide(el) {
  el?.classList.add("hidden");
}

function readInput(id) {
  return normalizeString(
    getEl(id)?.value
  );
}

function writeInput(id, value) {
  const el =
    getEl(id);

  if (!el) {
    return;
  }

  el.value =
    normalizeString(value);
}

function readStoredProfile() {
  const raw =
    window.sessionStorage.getItem(
      FIAT_CUSTOMER_PROFILE_KEY
    );

  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function writeStoredProfile(profile = {}) {
  window.sessionStorage.setItem(
    FIAT_CUSTOMER_PROFILE_KEY,
    JSON.stringify(profile)
  );

  return profile;
}

function normalizeResidentialAddress(address = {}) {
  return {
    street_line_1:
      normalizeString(
        address.street_line_1
      ),

    city:
      normalizeString(
        address.city
      ),

    state:
      normalizeString(
        address.state
      ),

    postal_code:
      normalizeString(
        address.postal_code
      ),

    country:
      normalizeString(
        address.country
      ).toUpperCase()
  };
}

function buildValidationError(field) {
  const err =
    new Error(
      `missing_${field}`
    );

  err.field =
    field;

  return err;
}

function validateCustomerProfile(profile = {}) {
  if (!normalizeString(profile.email)) {
    throw buildValidationError(
      "email"
    );
  }

  if (!normalizeString(profile.phone)) {
    throw buildValidationError(
      "phone"
    );
  }

  const address =
    profile.residential_address || {};

  if (!normalizeString(address.street_line_1)) {
    throw buildValidationError(
      "street_line_1"
    );
  }

  if (!normalizeString(address.city)) {
    throw buildValidationError(
      "city"
    );
  }

  if (!normalizeString(address.state)) {
    throw buildValidationError(
      "state"
    );
  }

  if (!normalizeString(address.postal_code)) {
    throw buildValidationError(
      "postal_code"
    );
  }

  if (!normalizeString(address.country)) {
    throw buildValidationError(
      "country"
    );
  }

  return true;
}

export function showCustomerProfileForm() {
  show(
    getEl("customerProfileBox")
  );
}

export function hideCustomerProfileForm() {
  hide(
    getEl("customerProfileBox")
  );
}

export function prepareCustomerProfileForm() {
  showCustomerProfileForm();

  syncCustomerProfileFormFromStorage();
}

export function readCustomerProfile() {
  return readStoredProfile();
}

export function clearCustomerProfile() {
  window.sessionStorage.removeItem(
    FIAT_CUSTOMER_PROFILE_KEY
  );
}

export function upsertCustomerProfile(values = {}) {
  const existing =
    readStoredProfile();

  const next = {
    ...existing
  };

  const email =
    normalizeString(values.email);

  if (email) {
    next.email =
      email;
  }

  if (values.phone !== undefined) {
    next.phone =
      normalizeString(values.phone);
  }

  if (values.residential_address !== undefined) {
    next.residential_address =
      normalizeResidentialAddress({
        ...(existing.residential_address || {}),
        ...(values.residential_address || {})
      });
  }

  Object.entries(
    BRIDGE_PROFILE_DEFAULTS
  ).forEach(([key, defaultValue]) => {
    const value =
      values[key] !== undefined
        ? values[key]
        : existing[key] !== undefined
          ? existing[key]
          : defaultValue;

    next[key] =
      normalizeString(value);
  });

  return writeStoredProfile(
    next
  );
}

export function syncCustomerProfileFormFromStorage() {
  const profile =
    readStoredProfile();

  writeInput(
    "customerPhone",
    profile.phone
  );

  const address =
    profile.residential_address || {};

  writeInput(
    "customerStreetLine1",
    address.street_line_1
  );

  writeInput(
    "customerCity",
    address.city
  );

  writeInput(
    "customerState",
    address.state
  );

  writeInput(
    "customerPostalCode",
    address.postal_code
  );

  writeInput(
    "customerCountry",
    address.country || "BRA"
  );
}

export function saveCustomerProfileFromForm() {
  const existing =
    readStoredProfile();

  const profile = {
    email:
      normalizeString(existing.email),

    phone:
      readInput("customerPhone"),

    residential_address:
      normalizeResidentialAddress({
        street_line_1:
          readInput("customerStreetLine1"),

        city:
          readInput("customerCity"),

        state:
          readInput("customerState"),

        postal_code:
          readInput("customerPostalCode"),

        country:
          readInput("customerCountry") || "BRA"
      }),

    ...BRIDGE_PROFILE_DEFAULTS
  };

  validateCustomerProfile(
    profile
  );

  return writeStoredProfile(
    profile
  );
}

export function ensureCustomerProfileFromForm() {
  showCustomerProfileForm();

  return saveCustomerProfileFromForm();
}

export function requireCustomerProfile() {
  const profile =
    readStoredProfile();

  validateCustomerProfile(
    profile
  );

  return profile;
}

export function focusCustomerProfileField(field) {
  const fieldToId = {
    phone:
      "customerPhone",

    street_line_1:
      "customerStreetLine1",

    city:
      "customerCity",

    state:
      "customerState",

    postal_code:
      "customerPostalCode",

    country:
      "customerCountry",

    email:
      null
  };

  const id =
    fieldToId[field];

  if (!id) {
    return;
  }

  const el =
    getEl(id);

  if (!el) {
    return;
  }

  el.focus();
}
