// shared/pay/kyc/identityProfile.js

/*
--------------------------------------------------
Canonical identity profile

This module normalizes the non-document personal
identity facts used by the UniBridge KYC domain.

It is a frontend projection only.

It does NOT:
- establish identity ownership
- replace the authoritative backend KYC record
- represent an authentication identity
- fabricate missing personal data
- infer nationality or residence
- contain provider-specific fields
- contain document numbers or document images
- contain contact or residential-profile data

Important backend distinction:

customer_id
  = canonical UniBridge customer

customer_identity_id
  = authentication identity binding
    (for example Clerk or wallet)

Neither identifier is a verified personal identity
profile.

The authoritative verified identity remains on the
backend / KYC provider side.
--------------------------------------------------
*/


function normalizeString(
  value
) {
  if (
    typeof value !==
      "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized ||
    null;
}


/*
--------------------------------------------------
Date of birth

Canonical output:
  YYYY-MM-DD

Accepts:
  YYYY-MM-DD
  Valid ISO datetime beginning with YYYY-MM-DD

Ambiguous or malformed date formats are
intentionally rejected.
--------------------------------------------------
*/

function normalizeDateOfBirth(
  value
) {
  const normalized =
    normalizeString(
      value
    );

  if (!normalized) {
    return null;
  }

  const match =
    normalized.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:$|T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$)/
    );

  if (!match) {
    return null;
  }

  const year =
    Number(
      match[1]
    );

  const month =
    Number(
      match[2]
    );

  const day =
    Number(
      match[3]
    );

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    date.getUTCFullYear() !==
      year ||
    date.getUTCMonth() !==
      month - 1 ||
    date.getUTCDate() !==
      day
  ) {
    return null;
  }

  return [
    match[1],
    match[2],
    match[3]
  ].join("-");
}


function removeNullish(
  value
) {
  return Object.fromEntries(
    Object.entries(
      value
    ).filter(
      ([
        ,
        item
      ]) =>
        item !== null &&
        item !== undefined
    )
  );
}


/*
--------------------------------------------------
Canonical profile builder

Input uses application-friendly camelCase.

Output follows the personal-identity field names
used by the backend KYC decision mapper:

  first_name
  last_name
  full_name
  date_of_birth
  nationality

Nationality is intentionally treated as an opaque
identity fact here.

Provider adapters are responsible for converting
it to a provider-specific country-code format when
required.

Only explicitly supplied valid facts are returned.
--------------------------------------------------
*/

export function buildIdentityProfile({
  firstName,
  lastName,
  fullName,
  dateOfBirth,
  nationality
} = {}) {
  return removeNullish({
    first_name:
      normalizeString(
        firstName
      ),

    last_name:
      normalizeString(
        lastName
      ),

    full_name:
      normalizeString(
        fullName
      ),

    date_of_birth:
      normalizeDateOfBirth(
        dateOfBirth
      ),

    nationality:
      normalizeString(
        nationality
      )
  });
}


/*
--------------------------------------------------
Profile helpers

Validation mirrors the builder rules so a profile
fact is considered present only when that field
would be accepted by buildIdentityProfile().
--------------------------------------------------
*/

const IDENTITY_PROFILE_VALIDATORS =
  Object.freeze({
    first_name:
      normalizeString,

    last_name:
      normalizeString,

    full_name:
      normalizeString,

    date_of_birth:
      normalizeDateOfBirth,

    nationality:
      normalizeString
  });


export function hasIdentityProfileFacts(
  profile
) {
  if (
    !profile ||
    typeof profile !==
      "object" ||
    Array.isArray(
      profile
    )
  ) {
    return false;
  }

  return Object.entries(
    IDENTITY_PROFILE_VALIDATORS
  ).some(
    ([
      field,
      normalize
    ]) =>
      normalize(
        profile[field]
      ) !== null
  );
}
