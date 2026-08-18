// pay-by-bank/js/state.js

const DEFAULT_STATE =
  Object.freeze({
    sourceCountry:
      null,

    receiverCountry:
      null,

    amount:
      null,

    phoneNumber:
      null,

    currency:
      "EUR",

    sessionId:
      null,

    selectedRoute:
      null,

    quote:
      null,

    settlementId:
      null,

    transactionId:
      null,

    paymentLink:
      null,

    status:
      "idle",

    error:
      null
  });


let state = {
  ...DEFAULT_STATE
};


export function getState() {
  return {
    ...state
  };
}


export function setState(
  patch = {}
) {
  if (
    !patch ||
    typeof patch !==
      "object" ||
    Array.isArray(
      patch
    )
  ) {
    return getState();
  }

  state = {
    ...state,
    ...patch
  };

  return getState();
}


export function resetState() {
  state = {
    ...DEFAULT_STATE
  };

  return getState();
}


export function setSourceCountry(
  sourceCountry
) {
  state.sourceCountry =
    normalizeCountry(
      sourceCountry
    );

  return state.sourceCountry;
}


export function setReceiverCountry(
  receiverCountry
) {
  state.receiverCountry =
    normalizeCountry(
      receiverCountry
    );

  return state.receiverCountry;
}


export function setAmount(
  amount
) {
  if (
    amount === undefined ||
    amount === null ||
    amount === ""
  ) {
    state.amount =
      null;

    return state.amount;
  }

  const parsed =
    Number(
      amount
    );

  state.amount =
    Number.isFinite(
      parsed
    ) &&
    parsed > 0
      ? parsed
      : null;

  return state.amount;
}


export function setPhoneNumber(
  phoneNumber
) {
  state.phoneNumber =
    normalizeString(
      phoneNumber
    );

  return state.phoneNumber;
}


export function setCurrency(
  currency
) {
  const normalized =
    String(
      currency ||
      ""
    )
      .trim()
      .toUpperCase();

  state.currency =
    normalized ||
    "EUR";

  return state.currency;
}


export function setSessionId(
  sessionId
) {
  state.sessionId =
    normalizeString(
      sessionId
    );

  return state.sessionId;
}


export function setSelectedRoute(
  route
) {
  state.selectedRoute =
    route &&
    typeof route ===
      "object" &&
    !Array.isArray(
      route
    )
      ? route
      : null;

  return state.selectedRoute;
}


export function setQuote(
  quote
) {
  state.quote =
    quote &&
    typeof quote ===
      "object" &&
    !Array.isArray(
      quote
    )
      ? quote
      : null;

  return state.quote;
}


export function clearQuoteState() {
  state.selectedRoute =
    null;

  state.quote =
    null;

  state.settlementId =
    null;

  state.transactionId =
    null;

  state.paymentLink =
    null;

  state.error =
    null;

  return getState();
}


export function setSettlementId(
  settlementId
) {
  state.settlementId =
    normalizeString(
      settlementId
    );

  return state.settlementId;
}


export function setTransactionId(
  transactionId
) {
  state.transactionId =
    normalizeString(
      transactionId
    );

  return state.transactionId;
}


export function setPaymentLink(
  paymentLink
) {
  state.paymentLink =
    normalizeString(
      paymentLink
    );

  return state.paymentLink;
}


export function setStatus(
  status
) {
  state.status =
    normalizeString(
      status
    ) ||
    "idle";

  return state.status;
}


export function setError(
  error
) {
  state.error =
    error ||
    null;

  return state.error;
}


function normalizeString(
  value
) {
  const normalized =
    String(
      value ??
      ""
    ).trim();

  return normalized ||
    null;
}


function normalizeCountry(
  value
) {
  const normalized =
    String(
      value ??
      ""
    )
      .trim()
      .toUpperCase();

  return normalized ||
    null;
}
