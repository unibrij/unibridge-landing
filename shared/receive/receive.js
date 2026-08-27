// unibridge-landing/shared/receive/receive.js

const RECEIVE_TOKEN_PREFIX =
  "ub_rcv_";

const RECEIVE_TOKEN_PATTERN =
  /^ub_rcv_[A-Za-z0-9_-]{43}$/;


/*
--------------------------------------------------
Normalization
--------------------------------------------------
*/

function normalizeString(
  value
) {
  return String(
    value ??
    ""
  ).trim();
}


function normalizeUpper(
  value
) {
  return normalizeString(
    value
  ).toUpperCase();
}


function normalizeLower(
  value
) {
  return normalizeString(
    value
  ).toLowerCase();
}


function normalizeObject(
  value
) {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    return {};
  }

  return value;
}


/*
--------------------------------------------------
Token
--------------------------------------------------
*/

export function normalizeReceiveToken(
  value
) {
  const token =
    normalizeString(
      value
    );

  return RECEIVE_TOKEN_PATTERN
    .test(
      token
    )
      ? token
      : "";
}


export function isValidReceiveToken(
  value
) {
  return Boolean(
    normalizeReceiveToken(
      value
    )
  );
}


/*
--------------------------------------------------
Receive URL
--------------------------------------------------
*/

export function buildReceiveUrl(
  token,
  {
    origin =
      window.location.origin
  } = {}
) {
  const normalizedToken =
    normalizeReceiveToken(
      token
    );

  if (!normalizedToken) {
    throw new Error(
      "invalid_receive_token"
    );
  }

  const normalizedOrigin =
    normalizeString(
      origin
    ).replace(
      /\/+$/,
      ""
    );

  if (!normalizedOrigin) {
    throw new Error(
      "invalid_receive_origin"
    );
  }

  return (
    normalizedOrigin +
    "/receive/" +
    encodeURIComponent(
      normalizedToken
    )
  );
}


/*
--------------------------------------------------
Extract token from location / URL
--------------------------------------------------
*/

export function extractReceiveToken(
  input =
    window.location
) {
  let pathname = "";

  if (
    typeof input ===
    "string"
  ) {
    try {
      pathname =
        new URL(
          input,
          window.location.origin
        ).pathname;
    }
    catch {
      pathname =
        input;
    }
  }
  else {
    pathname =
      normalizeString(
        input?.pathname
      );
  }

  const segments =
    pathname
      .split("/")
      .map(
        segment =>
          normalizeString(
            segment
          )
      )
      .filter(
        Boolean
      );

  const receiveIndex =
    segments.findIndex(
      segment =>
        segment ===
        "receive"
    );

  if (
    receiveIndex <
      0 ||
    receiveIndex >=
      segments.length - 1
  ) {
    return "";
  }

  let token = "";

  try {
    token =
      decodeURIComponent(
        segments[
          receiveIndex + 1
        ]
      );
  }
  catch {
    return "";
  }

  return normalizeReceiveToken(
    token
  );
}


/*
--------------------------------------------------
Public API response
--------------------------------------------------
*/

function normalizeRecipient(
  value
) {
  const recipient =
    normalizeObject(
      value
    );

  return {
    label:
      normalizeString(
        recipient.label
      ) ||
      "Recipient",

    masked_identifier:
      normalizeString(
        recipient
          .masked_identifier
      ) ||
      null
  };
}


export function normalizeReceiveProfile(
  value
) {
  const profile =
    normalizeObject(
      value
    );

  const receiveProfileId =
    normalizeString(
      profile
        .receive_profile_id
    );

  const country =
    normalizeUpper(
      profile.country
    );

  const payoutRail =
    normalizeLower(
      profile
        .payout_rail
    );

  if (
    !receiveProfileId ||
    !country ||
    !payoutRail
  ) {
    throw new Error(
      "invalid_receive_profile"
    );
  }

  return {
    receive_profile_id:
      receiveProfileId,

    status:
      normalizeLower(
        profile.status
      ) ||
      null,

    country,

    payout_rail:
      payoutRail,

    recipient:
      normalizeRecipient(
        profile.recipient
      )
  };
}


/*
--------------------------------------------------
Public Resolve

GET /v2/receive/:token through the shared proxy.

No Clerk token is required.
No beneficiary details are returned.
--------------------------------------------------
*/

export async function resolveReceiveProfile(
  token
) {
  const normalizedToken =
    normalizeReceiveToken(
      token
    );

  if (!normalizedToken) {
    throw new Error(
      "invalid_receive_token"
    );
  }

  const endpoint =
    "receive/" +
    normalizedToken;

  const url =
    new URL(
      "/api/proxy",
      window.location.origin
    );

  url.searchParams.set(
    "endpoint",
    endpoint
  );

  const response =
    await fetch(
      url.toString(),
      {
        method:
          "GET",

        headers: {
          "Accept":
            "application/json"
        }
      }
    );

  const text =
    await response.text();

  let data = {};

  try {
    data =
      text
        ? JSON.parse(
            text
          )
        : {};
  }
  catch {
    data = {
      raw:
        text
    };
  }

  if (!response.ok) {
    const message =
      typeof data?.error ===
        "string"
        ? data.error
        : data?.error
            ?.message ||
          data?.message ||
          data?.raw ||
          "receive_resolve_failed";

    const error =
      new Error(
        message
      );

    error.status =
      response.status;

    error.data =
      data;

    throw error;
  }

  return normalizeReceiveProfile(
    data
  );
}


/*
--------------------------------------------------
Generic Receive context

This is the only destination context that payment
surfaces need.

It contains no funding information and no raw
beneficiary details.
--------------------------------------------------
*/

export function buildReceiveContext(
  profile
) {
  const normalizedProfile =
    normalizeReceiveProfile(
      profile
    );

  return {
    receive_profile_id:
      normalizedProfile
        .receive_profile_id,

    destination_country:
      normalizedProfile
        .country,

    payout_rail:
      normalizedProfile
        .payout_rail,

    recipient:
      normalizedProfile
        .recipient
  };
}


export {
  RECEIVE_TOKEN_PREFIX,
  RECEIVE_TOKEN_PATTERN
};
