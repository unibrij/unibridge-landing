// connect-app/src/flow/kyc.js

export function isKycAlreadyPassed(payload = {}) {
  const status =
    String(
      payload.kyc_status ||
        payload.verification_status ||
        payload.status ||
        ""
    )
      .trim()
      .toLowerCase();

  const nextStep =
    String(payload.next_step || "")
      .trim()
      .toLowerCase();

  return (
    status === "passed" ||
    status === "approved" ||
    status === "verified" ||
    nextStep === "create_settlement" ||
    nextStep === "prepare_funding" ||
    nextStep === "create_funding" ||
    nextStep === "funding"
  );
}

export function isMissingKycUrlError(err) {
  return String(err?.message || err || "")
    .toLowerCase()
    .includes("kyc_url_missing");
}
