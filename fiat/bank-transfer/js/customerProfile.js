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
    "national_id"
};

function normalizeString(value) {
  return String(value || "").trim();
}

/*
--------------------------------------------------
Bridge customer/KYC country normalizer
--------------------------------------------------
Important:
- This is only for customer profile fields:
  residential_address.country / issuing_country.
- Do NOT use this to normalize funding source market
  or source_country/source_rail from the registered route.
--------------------------------------------------
*/

function normalizeBridgeCountry(value) {
  const normalized =
    normalizeString(value).toUpperCase();

  const map = {
    BR:
      "BRA",

    BRA:
      "BRA",

    US:
      "USA",

    USA:
      "USA",

    GB:
      "GBR",

    UK:
      "GBR",

    GBR:
      "GBR"
  };

  return map[normalized] || normalized;
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

function readClerkEmail() {
  const clerk =
    window.Clerk;

  const user =
    clerk?.user;

  return normalizeString(
    user?.primaryEmailAddress?.emailAddress ||
      user?.emailAddresses?.[0]?.emailAddress ||
      user?.email ||
      ""
  );
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
      normalizeBridgeCountry(
        address.country
      )
  };
}

function normalizeBridgeProfile(profile = {}) {
  const address =
    normalizeResidentialAddress(
      profile.residential_address || {}
    );

  const email =
    normalizeString(
      profile.email
    ) || readClerkEmail();

  const issuingCountry =
    normalizeBridgeCountry(
      profile.issuing_country ||
        address.country
    );

  return {
    ...BRIDGE_PROFILE_DEFAULTS,

    ...profile,

    email,

    phone:
      normalizeString(
        profile.phone
      ),

    customer_region:
      normalizeString(
        profile.customer_region ||
          BRIDGE_PROFILE_DEFAULTS.customer_region
      ),

    employment_status:
      normalizeString(
        profile.employment_status ||
          BRIDGE_PROFILE_DEFAULTS.employment_status
      ),

    expected_monthly_payments:
      normalizeString(
        profile.expected_monthly_payments ||
          BRIDGE_PROFILE_DEFAULTS.expected_monthly_payments
      ),

    acting_as_intermediary:
      normalizeString(
        profile.acting_as_intermediary ||
          BRIDGE_PROFILE_DEFAULTS.acting_as_intermediary
      ),

    most_recent_occupation:
      normalizeString(
        profile.most_recent_occupation ||
          BRIDGE_PROFILE_DEFAULTS.most_recent_occupation
      ),

    account_purpose:
      normalizeString(
        profile.account_purpose ||
          BRIDGE_PROFILE_DEFAULTS.account_purpose
      ),

    source_of_funds:
      normalizeString(
        profile.source_of_funds ||
          BRIDGE_PROFILE_DEFAULTS.source_of_funds
      ),

    identification_type:
      normalizeString(
        profile.identification_type ||
          BRIDGE_PROFILE_DEFAULTS.identification_type
      ),

    issuing_country:
      issuingCountry,

    residential_address:
      address
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

  if (!normalizeString(profile.issuing_country)) {
    throw buildValidationError(
      "issuing_country"
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
  return normalizeBridgeProfile(
    readStoredProfile()
  );
}

export function clearCustomerProfile() {
  window.sessionStorage.removeItem(
    FIAT_CUSTOMER_PROFILE_KEY
  );
}

export function upsertCustomerProfile(values = {}) {
  const existing =
    normalizeBridgeProfile(
      readStoredProfile()
    );

  const next = {
    ...existing
  };

  const email =
    normalizeString(
      values.email
    ) || existing.email || readClerkEmail();

  if (email) {
    next.email =
      email;
  }

  if (values.phone !== undefined) {
    next.phone =
      normalizeString(
        values.phone
      );
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
      normalizeString(
        value
      );
  });

  if (values.issuing_country !== undefined) {
    next.issuing_country =
      normalizeBridgeCountry(
        values.issuing_country
      );
  }

  return writeStoredProfile(
    normalizeBridgeProfile(
      next
    )
  );
}

export function syncCustomerProfileFormFromStorage() {
  const profile =
    normalizeBridgeProfile(
      readStoredProfile()
    );

  writeStoredProfile(
    profile
  );

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
    address.country
  );
}

export function saveCustomerProfileFromForm() {
  const existing =
    normalizeBridgeProfile(
      readStoredProfile()
    );

  const residentialAddress =
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
        readInput("customerCountry")
    });

  const profile =
    normalizeBridgeProfile({
      ...BRIDGE_PROFILE_DEFAULTS,

      ...existing,

      email:
        normalizeString(
          existing.email
        ) || readClerkEmail(),

      phone:
        readInput("customerPhone"),

      residential_address:
        residentialAddress,

      issuing_country:
        existing.issuing_country ||
          residentialAddress.country
    });

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
    normalizeBridgeProfile(
      readStoredProfile()
    );

  validateCustomerProfile(
    profile
  );

  writeStoredProfile(
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

    issuing_country:
      null,

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
