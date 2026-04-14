// surface/public/js/settlementViewState.js

window.UnibridgeSettlementViewState = (() => {
  /*
  --------------------------------------------------
  Helpers
  --------------------------------------------------
  */

  function normalizeStatus(status) {
    return typeof status === "string"
      ? status.trim().toLowerCase()
      : "";
  }

  /*
  --------------------------------------------------
  User-facing settlement state
  --------------------------------------------------
  This is UI-only mapping.
  It does NOT define backend truth and should remain
  safe for public/surface display.
  --------------------------------------------------
  */

  function getUserFacingSettlementState(status) {
    const s =
      normalizeStatus(status);

    /*
    ------------------------------------------------
    Awaiting funding
    ------------------------------------------------
    */

    if (
      s === "created" ||
      s === "waiting_ramp_payment"
    ) {
      return {
        key: "awaiting_funding",
        title: "Awaiting funding"
      };
    }

    /*
    ------------------------------------------------
    Funding received, execution starting
    ------------------------------------------------
    */

    if (
      s === "funding_confirmed" ||
      s === "submitted" ||
      s === "executing"
    ) {
      return {
        key: "executing",
        title: "Funding received. Transfer execution is progress."
      };
    }

    /*
    ------------------------------------------------
    Processing / automatic retry in background
    ------------------------------------------------
    Do not expose retry internals to the user.
    Present both as normal in-progress handling.
    ------------------------------------------------
    */

    if (
      s === "processing" ||
      s === "execution_retryable"
    ) {
      return {
        key: "processing",
        title: "Your transfer is being processed."
      };
    }

    /*
    ------------------------------------------------
    Manual internal review
    ------------------------------------------------
    Funding was received, but internal/operator
    intervention is required. User should not see
    internal reason codes.
    ------------------------------------------------
    */

    if (s === "manual_resume_required") {
      return {
        key: "under_review",
        title: "Funding received. Your transfer is under internal review."
      };
    }

    /*
    ------------------------------------------------
    Success
    ------------------------------------------------
    */

    if (s === "completed") {
      return {
        key: "completed",
        title: "Your transfer was completed successfully."
      };
    }

    /*
    ------------------------------------------------
    Final failure
    ------------------------------------------------
    */

    if (s === "failed") {
      return {
        key: "failed",
        title: "We could not complete your transfer."
      };
    }

    /*
    ------------------------------------------------
    Unknown fallback
    ------------------------------------------------
    */

    return {
      key: "unknown",
      title: "Status is currently unavailable."
    };
  }

  /*
  --------------------------------------------------
  Post-funding settlement detector
  --------------------------------------------------
  Useful for surface flows that need to know whether
  the settlement has already moved beyond the funding
  stage and should therefore be rendered as status
  tracking instead of funding continuation.
  --------------------------------------------------
  */

  function isPostFundingSettlementStatus(status) {
    const s =
      normalizeStatus(status);

    return [
      "funding_confirmed",
      "submitted",
      "executing",
      "processing",
      "execution_retryable",
      "manual_resume_required",
      "completed",
      "failed"
    ].includes(s);
  }

  return {
    getUserFacingSettlementState,
    isPostFundingSettlementStatus
  };
})();
