// unibrij/unibridge-landing/surface/core/settlementRefresh.js

/*
--------------------------------------------------
Surface Settlement Refresh

Purpose:
- keep settlement status refresh outside app.js
- fetch settlement/status
- update current funding provider through callback
- delegate UI/status handling to existing UnibridgeStatus
- avoid route/destination/payment creation logic here

Notes:
- This module does not create settlements.
- This module does not start funding sessions.
- This module does not touch Brazil / SmartPay.
--------------------------------------------------
*/

export async function refreshSettlementState({
  apiGet,
  settlementId,
  getFundingSelectedProvider,
  setCurrentFundingProvider,
  handleSettlementStatus,
  signBtn,
  continueBtn,
  emit,
  setStatus,
  clearState
} = {}) {
  if (!settlementId) {
    return null;
  }

  if (typeof apiGet !== "function") {
    throw new Error("api_get_missing");
  }

  const status =
    await apiGet("settlement/status", {
      settlement_id:
        settlementId
    });

  if (
    typeof getFundingSelectedProvider === "function" &&
    typeof setCurrentFundingProvider === "function"
  ) {
    setCurrentFundingProvider(
      getFundingSelectedProvider(status)
    );
  }

  if (typeof handleSettlementStatus === "function") {
    handleSettlementStatus({
      status,
      signBtn,
      continueBtn,
      emit,
      setStatus,
      clearState
    });
  }

  return status;
}
