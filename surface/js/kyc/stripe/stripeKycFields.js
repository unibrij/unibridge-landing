// unibridge-landing/surface/js/kyc/stripe/stripeKycFields.js

const SUPPORTED_NON_SENSITIVE_FIELDS =
  Object.freeze([
    "given_name",
    "surname",
    "date_of_birth",
    "address.line1",
    "address.line2",
    "address.city",
    "address.state",
    "address.postal_code",
    "address.country"
  ]);

const BROWSER_ONLY_FIELDS =
  Object.freeze([
    "id_number"
  ]);

function normalizeString(value) {
  return String(
    value ?? ""
  ).trim();
}

function requireString(
  value,
  errorCode
) {
  const normalized =
    normalizeString(value);

  if (!normalized) {
    throw new Error(
      errorCode
    );
  }

  return normalized;
}

export function assertSupportedMissingFields(
  missingFields
) {
  const unsupported =
    (
      Array.isArray(missingFields)
        ? missingFields
        : []
    )
      .filter(
        (field) =>
          !SUPPORTED_NON_SENSITIVE_FIELDS
            .includes(field) &&
          !BROWSER_ONLY_FIELDS
            .includes(field)
      );

  if (
    unsupported.length
  ) {
    const error =
      new Error(
        "stripe_kyc_unsupported_missing_fields"
      );

    error.fields =
      unsupported;

    throw error;
  }
}

export function parseDateOfBirth(
  value
) {
  const normalized =
    requireString(
      value,
      "stripe_kyc_date_of_birth_required"
    );

  const match =
    normalized.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (!match) {
    throw new Error(
      "stripe_kyc_invalid_date_of_birth"
    );
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  const day =
    Number(match[3]);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(
      "stripe_kyc_invalid_date_of_birth"
    );
  }

  return {
    year,
    month,
    day
  };
}

export function normalizeLocalUsSsn(
  value
) {
  const normalized =
    requireString(
      value,
      "stripe_kyc_id_number_required"
    )
      .replace(
        /\D/g,
        ""
      );

  if (
    !/^\d{9}$/.test(
      normalized
    )
  ) {
    throw new Error(
      "stripe_kyc_invalid_us_ssn"
    );
  }

  return normalized;
}

export function buildStripeKycSupplement(
  values,
  missingFields
) {
  const supplement = {};
  const address = {};

  if (
    missingFields.includes(
      "given_name"
    )
  ) {
    supplement.given_name =
      requireString(
        values.given_name,
        "stripe_kyc_given_name_required"
      );
  }

  if (
    missingFields.includes(
      "surname"
    )
  ) {
    supplement.surname =
      requireString(
        values.surname,
        "stripe_kyc_surname_required"
      );
  }

  if (
    missingFields.includes(
      "date_of_birth"
    )
  ) {
    supplement.date_of_birth =
      parseDateOfBirth(
        values.date_of_birth
      );
  }

  if (
    missingFields.includes(
      "address.line1"
    )
  ) {
    address.line1 =
      requireString(
        values.address_line1,
        "stripe_kyc_address_line1_required"
      );
  }

  if (
    missingFields.includes(
      "address.line2"
    )
  ) {
    const line2 =
      normalizeString(
        values.address_line2
      );

    if (line2) {
      address.line2 =
        line2;
    }
  }

  if (
    missingFields.includes(
      "address.city"
    )
  ) {
    address.city =
      requireString(
        values.address_city,
        "stripe_kyc_address_city_required"
      );
  }

  if (
    missingFields.includes(
      "address.state"
    )
  ) {
    address.state =
      requireString(
        values.address_state,
        "stripe_kyc_address_state_required"
      );
  }

  if (
    missingFields.includes(
      "address.postal_code"
    )
  ) {
    address.postal_code =
      requireString(
        values.address_postal_code,
        "stripe_kyc_address_postal_code_required"
      );
  }

  if (
    missingFields.includes(
      "address.country"
    )
  ) {
    address.country =
      requireString(
        values.address_country,
        "stripe_kyc_address_country_required"
      )
        .toUpperCase();

    if (
      !/^[A-Z]{2}$/.test(
        address.country
      )
    ) {
      throw new Error(
        "stripe_kyc_invalid_address_country"
      );
    }
  }

  if (
    Object.keys(address)
      .length
  ) {
    supplement.address =
      address;
  }

  return supplement;
}

export function buildStripeKycPayload({
  stripeKycInfo,
  idNumber = null
} = {}) {
  if (
    !stripeKycInfo ||
    typeof stripeKycInfo !==
      "object"
  ) {
    throw new Error(
      "stripe_kyc_info_missing"
    );
  }

  const payload = {
    ...stripeKycInfo
  };

  if (idNumber) {
    payload.id_number = {
      type:
        "us_ssn",

      value:
        idNumber
    };
  }

  return payload;
}
