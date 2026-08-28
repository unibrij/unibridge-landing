// unibridge-landing/shared/receive/receive-context.js

const RECEIVE_CONTEXT_KEY =
  "unibridge_receive_context";

const RECEIVE_PROFILE_ID_PATTERN =
  /^rcv_[A-Za-z0-9_-]+$/;


function normalizeString(value) {
  return String(value ?? "").trim();
}

function normalizeObject(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return value;
}

function normalizeReceiveContext(value) {
  const context =
    normalizeObject(value);

  const receiveProfileId =
    normalizeString(
      context.receive_profile_id
    );

  if (
    !receiveProfileId ||
    !RECEIVE_PROFILE_ID_PATTERN.test(
      receiveProfileId
    )
  ) {
    return null;
  }

  return {
    receive_profile_id:
      receiveProfileId,

    destination_country:
      normalizeString(
        context.destination_country
      ).toUpperCase() ||
      null,

    payout_rail:
      normalizeString(
        context.payout_rail
      ).toLowerCase() ||
      null,

    recipient: {
      label:
        normalizeString(
          context.recipient?.label
        ) ||
        null,

      masked_identifier:
        normalizeString(
          context.recipient
            ?.masked_identifier
        ) ||
        null
    }
  };
}


export function setReceiveContext(context) {
  const normalized =
    normalizeReceiveContext(
      context
    );

  if (!normalized) {
    throw new Error(
      "invalid_receive_context"
    );
  }

  sessionStorage.setItem(
    RECEIVE_CONTEXT_KEY,
    JSON.stringify(normalized)
  );

  return normalized;
}


export function getReceiveContext() {
  const raw =
    sessionStorage.getItem(
      RECEIVE_CONTEXT_KEY
    );

  if (!raw) {
    return null;
  }

  let parsed;

  try {
    parsed =
      JSON.parse(raw);
  }
  catch {
    clearReceiveContext();
    return null;
  }

  const normalized =
    normalizeReceiveContext(
      parsed
    );

  if (!normalized) {
    clearReceiveContext();
    return null;
  }

  return normalized;
}


export function clearReceiveContext() {
  sessionStorage.removeItem(
    RECEIVE_CONTEXT_KEY
  );
}


export function getReceiveProfileId() {
  return (
    getReceiveContext()
      ?.receive_profile_id ||
    null
  );
}


export {
  RECEIVE_CONTEXT_KEY
};
