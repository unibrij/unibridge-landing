// pay-by-bank/js/state.js

const DEFAULT_STATE = Object.freeze({
  sourceCountry:
    null,

  amount:
    null,

  currency:
    "EUR",

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
    typeof patch !== "object" ||
    Array.isArray(patch)
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
  return setState({
    sourceCountry:
      sourceCountry
        ? String(
            sourceCountry
          )
            .toUpperCase()
            .trim()
        : null
  });
}


export function setAmount(
  amount
) {
  const parsed =
    Number(amount);

  return setState({
    amount:
      Number.isFinite(parsed) &&
      parsed > 0
        ? parsed
        : null
  });
}


export function setSettlementId(
  settlementId
) {
  return setState({
    settlementId:
      settlementId
        ? String(
            settlementId
          ).trim()
        : null
  });
}


export function setTransactionId(
  transactionId
) {
  return setState({
    transactionId:
      transactionId
        ? String(
            transactionId
          ).trim()
        : null
  });
}


export function setPaymentLink(
  paymentLink
) {
  return setState({
    paymentLink:
      paymentLink
        ? String(
            paymentLink
          ).trim()
        : null
  });
}


export function setStatus(
  status
) {
  return setState({
    status:
      status
        ? String(
            status
          )
            .toLowerCase()
            .trim()
        : "idle"
  });
}


export function setError(
  error
) {
  return setState({
    error:
      error ||
      null
  });
}
