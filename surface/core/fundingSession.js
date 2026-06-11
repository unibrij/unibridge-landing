// unibrij/unibridge-landing/surface/core/fundingSession.js

/*
--------------------------------------------------
Surface Funding Session

Purpose:
- keep funding session creation outside app.js
- create ramp/card funding session
- validate provider payment URL
- open payment URL
- mark payment as started through callback

Notes:
- This module does not pick routes.
- This module does not build destinations.
- This module does not touch Brazil / SmartPay.
- It only uses the provider selected by settlement/session flow.
--------------------------------------------------
*/

function normalizeString(value) {
  return String(value || "")
    .trim();
}

function getPaymentUrl(fundingSession = {}) {
  return normalizeString(
    fundingSession.provider_payment_url ||
      fundingSession.payment_url ||
      fundingSession.checkout_url ||
      fundingSession.url
  );
}

function getFundingProvider(fundingSession = {}) {
  return normalizeString(
    fundingSession.provider ||
      fundingSession.funding_provider ||
      fundingSession.sender_id
  ) || null;
}

export async function createFundingSession({
  apiPost,
  sessionId,
  settlementId,
  amount,
  sourceCountry,
  returnUrl
} = {}) {
  if (typeof apiPost !== "function") {
    throw new Error("api_post_missing");
  }

  if (!sessionId) {
    throw new Error("missing_session_id");
  }

  if (!settlementId) {
    throw new Error("missing_settlement_id");
  }

  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    throw new Error("invalid_amount");
  }

  return apiPost("funding/session", {
    session_id:
      sessionId,

    settlement_id:
      settlementId,

    amount:
      Number(amount),

    source_country:
      sourceCountry,

    return_url:
      returnUrl
  });
}

export async function createAndOpenFundingSession({
  apiPost,
  sessionId,
  settlementId,
  amount,
  sourceCountry,
  returnUrl,
  setCurrentFundingProvider,
  markPaymentStarted,
  openWindow = true
} = {}) {
  const fundingSession =
    await createFundingSession({
      apiPost,
      sessionId,
      settlementId,
      amount,
      sourceCountry,
      returnUrl
    });

  const provider =
    getFundingProvider(fundingSession);

  if (
    provider &&
    typeof setCurrentFundingProvider === "function"
  ) {
    setCurrentFundingProvider(provider);
  }

  const paymentUrl =
    getPaymentUrl(fundingSession);

  if (!paymentUrl) {
    throw new Error("missing_payment_url");
  }

  if (typeof markPaymentStarted === "function") {
    markPaymentStarted();
  }

  if (openWindow) {
    window.location.href =
      paymentUrl;
  }

  return {
    fundingSession,
    paymentUrl,
    provider
  };
}

export {
  getPaymentUrl,
  getFundingProvider
};
