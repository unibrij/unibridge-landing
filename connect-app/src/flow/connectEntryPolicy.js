// connect-app/src/flow/connectEntryPolicy.js

function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}


export function resolveConnectEntry({
  returnedPayoutIntentId,
  repeatSourceFromUrl,
  repeatRouteIdFromUrl,

  storedFlow,

  receiveBound,
  receiveProfileId,

  defaultRouteId
} = {}) {
  const returnedId =
    normalizeString(
      returnedPayoutIntentId
    ) ||
    null;

  const repeatSourceId =
    normalizeString(
      repeatSourceFromUrl
    ) ||
    null;

  const repeatRouteId =
    normalizeString(
      repeatRouteIdFromUrl
    ) ||
    null;

  const storedRepeatSourceId =
    normalizeString(
      storedFlow
        ?.repeat_source_payout_intent_id
    ) ||
    null;

  const storedPayoutIntentId =
    normalizeString(
      storedFlow
        ?.payout_intent_id
    ) ||
    null;

  const storedRouteId =
    normalizeString(
      storedFlow
        ?.route_id
    ) ||
    null;

  const normalizedReceiveProfileId =
    normalizeString(
      receiveProfileId
    ) ||
    null;

  const normalizedDefaultRouteId =
    normalizeString(
      defaultRouteId
    ) ||
    null;

  /*
   * Explicit entry precedence:
   *
   * Returned URL
   * → Repeat URL
   * → Receive context
   * → Stored Repeat
   * → Stored Standard
   */
  if (returnedId) {
    return {
      kind:
        "returned",

      returnedPayoutIntentId:
        returnedId,

      repeatSourcePayoutIntentId:
        null,

      receiveProfileId:
        null,

      initialSelectedRouteId:
        storedRouteId ||
        normalizedDefaultRouteId,

      initialPayoutIntentId:
        returnedId,

      accessPayoutIntentId:
        returnedId
    };
  }

  if (repeatSourceId) {
    return {
      kind:
        "repeat",

      returnedPayoutIntentId:
        null,

      repeatSourcePayoutIntentId:
        repeatSourceId,

      receiveProfileId:
        null,

      initialSelectedRouteId:
        repeatRouteId ||
        storedRouteId ||
        normalizedDefaultRouteId,

      initialPayoutIntentId:
        null,

      accessPayoutIntentId:
        repeatSourceId
    };
  }

  if (
    receiveBound &&
    normalizedReceiveProfileId
  ) {
    return {
      kind:
        "receive",

      returnedPayoutIntentId:
        null,

      repeatSourcePayoutIntentId:
        null,

      receiveProfileId:
        normalizedReceiveProfileId,

      /*
       * Do not inherit an unrelated stored route.
       * useConnectRoutes resolves the Receive route.
       */
      initialSelectedRouteId:
        normalizedDefaultRouteId,

      initialPayoutIntentId:
        null,

      accessPayoutIntentId:
        null
    };
  }

  if (storedRepeatSourceId) {
    return {
      kind:
        "repeat",

      returnedPayoutIntentId:
        null,

      repeatSourcePayoutIntentId:
        storedRepeatSourceId,

      receiveProfileId:
        null,

      initialSelectedRouteId:
        storedRouteId ||
        normalizedDefaultRouteId,

      initialPayoutIntentId:
        null,

      accessPayoutIntentId:
        storedRepeatSourceId
    };
  }

  return {
    kind:
      "standard",

    returnedPayoutIntentId:
      null,

    repeatSourcePayoutIntentId:
      null,

    receiveProfileId:
      null,

    initialSelectedRouteId:
      storedRouteId ||
      normalizedDefaultRouteId,

    initialPayoutIntentId:
      storedPayoutIntentId,

    accessPayoutIntentId:
      storedPayoutIntentId
  };
}


export function isReturnedEntry(
  entry
) {
  return (
    entry?.kind ===
    "returned"
  );
}


export function isRepeatEntry(
  entry
) {
  return (
    entry?.kind ===
    "repeat"
  );
}


export function isReceiveEntry(
  entry
) {
  return (
    entry?.kind ===
    "receive"
  );
}
