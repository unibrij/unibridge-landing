// connect-app/src/hooks/useConnectReceiveContext.js

import {
  useMemo
} from "react";


const RECEIVE_CONTEXT_KEY =
  "unibridge_receive_context";

const RECEIVE_PROFILE_ID_PATTERN =
  /^rcv_[A-Za-z0-9_-]+$/;


function normalizeString(value) {
  return String(
    value ??
    ""
  ).trim();
}


function normalizeReceiveContext(value) {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    return null;
  }

  const receiveProfileId =
    normalizeString(
      value.receive_profile_id
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
        value.destination_country
      ).toUpperCase() ||
      null,

    payout_rail:
      normalizeString(
        value.payout_rail
      ).toLowerCase() ||
      null,

    recipient: {
      label:
        normalizeString(
          value.recipient?.label
        ) ||
        null,

      masked_identifier:
        normalizeString(
          value.recipient
            ?.masked_identifier
        ) ||
        null
    }
  };
}


function readReceiveContext() {
  let raw;

  try {
    raw =
      window.sessionStorage
        .getItem(
          RECEIVE_CONTEXT_KEY
        );
  }
  catch {
    return null;
  }

  if (!raw) {
    return null;
  }

  try {
    return normalizeReceiveContext(
      JSON.parse(
        raw
      )
    );
  }
  catch {
    return null;
  }
}


export default function useConnectReceiveContext() {
  const receiveContext =
    useMemo(
      () =>
        readReceiveContext(),
      []
    );

  const receiveProfileId =
    receiveContext
      ?.receive_profile_id ||
    null;

  const destinationCountry =
    receiveContext
      ?.destination_country ||
    null;

  const payoutRail =
    receiveContext
      ?.payout_rail ||
    null;

  const recipient =
    receiveContext
      ?.recipient ||
    null;

  const receiveBound =
    Boolean(
      receiveProfileId
    );

  return {
    receiveContext,
    receiveBound,
    receiveProfileId,
    destinationCountry,
    payoutRail,
    recipient
  };
}
