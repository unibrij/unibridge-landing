// unibridge-landing/surface/public/kyc-payload.js

/*
--------------------------------------------------
Generic KYC payload builder
--------------------------------------------------
Frontend supplies only available user facts.
Do not fabricate provider-specific identity data here.
Backend / next_action flow decides what is required.
--------------------------------------------------
*/

export function buildKycPayload({
  telegramUser,
  sourceCountry
}) {
  const normalizedCountry =
    String(sourceCountry || "")
      .toUpperCase()
      .trim();

  const payload = {
    firstName: telegramUser?.first_name || "Test",
    lastName: telegramUser?.last_name || "User",
    dob: "1990-01-01"
  };

  if (normalizedCountry) {
    payload.countryCode = normalizedCountry;
  }

  return payload;
}
