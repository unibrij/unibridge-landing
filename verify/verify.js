// receipts/verify/verify.js

const loadingState =
  document.getElementById(
    "loading-state"
  );

const verifiedState =
  document.getElementById(
    "verified-state"
  );

const failedState =
  document.getElementById(
    "failed-state"
  );

const verifiedReference =
  document.getElementById(
    "verified-reference"
  );

const failedReference =
  document.getElementById(
    "failed-reference"
  );

const verifiedStatus =
  document.getElementById(
    "verified-status"
  );

const verifiedStanding =
  document.getElementById(
    "verified-standing"
  );

const verifiedIssued =
  document.getElementById(
    "verified-issued"
  );

const amountRow =
  document.getElementById(
    "amount-row"
  );

const recipientAmountRow =
  document.getElementById(
    "recipient-amount-row"
  );

function showState(
  state
) {
  loadingState.hidden =
    state !== "loading";

  verifiedState.hidden =
    state !== "verified";

  failedState.hidden =
    state !== "failed";
}

function readPublicReference() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  return (
    params.get(
      "ref"
    ) || ""
  ).trim();
}

function readVerificationToken() {
  const hash =
    window.location.hash.startsWith(
      "#"
    )
      ? window.location.hash.slice(
          1
        )
      : window.location.hash;

  const params =
    new URLSearchParams(
      hash
    );

  return (
    params.get(
      "token"
    ) || ""
  ).trim();
}

function formatLabel(
  value
) {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    return "—";
  }

  return value
    .trim()
    .replace(
      /_/g,
      " "
    )
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

function formatDate(
  value
) {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    return "—";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle:
        "medium",
      timeStyle:
        "short"
    }
  ).format(
    date
  );
}

function readFirstDefined(
  ...values
) {
  for (
    const value of values
  ) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      return value;
    }
  }

  return null;
}

function renderVerified(
  result,
  fallbackReference
) {
  const projection =
    result?.projection &&
    typeof result.projection ===
      "object"
      ? result.projection
      : {};

  const verification =
    result?.verification &&
    typeof result.verification ===
      "object"
      ? result.verification
      : {};

  if (
    verification?.verified !==
      true ||
    verification?.token_valid !==
      true ||
    verification?.integrity_valid !==
      true
  ) {
    throw new Error(
      "Receipt verification result was not valid."
    );
  }

  const publicReference =
    readFirstDefined(
      result?.public_reference,
      projection?.public_reference,
      fallbackReference
    );

  const status =
    readFirstDefined(
      projection?.transfer
        ?.transfer_status
    );

  const standing =
    readFirstDefined(
      projection?.standing
        ?.status
    );

  const issuedAt =
    readFirstDefined(
      projection?.issued_at
    );

  verifiedReference.textContent =
    publicReference || "";

  verifiedStatus.textContent =
    formatLabel(
      status
    );

  verifiedStanding.textContent =
    formatLabel(
      standing
    );

  verifiedIssued.textContent =
    formatDate(
      issuedAt
    );

  /*
  =====================================================
  AMOUNT ROWS

  The current public receipt projection does not expose
  enough currency/asset metadata to render these values
  safely and accurately.

  Keep them hidden until the backend public contract
  explicitly includes both amount and currency/asset.
  =====================================================
  */

  if (amountRow) {
    amountRow.hidden =
      true;
  }

  if (recipientAmountRow) {
    recipientAmountRow.hidden =
      true;
  }

  showState(
    "verified"
  );
}

function renderFailed(
  publicReference
) {
  failedReference.textContent =
    publicReference || "";

  showState(
    "failed"
  );
}

async function verifyReceipt() {
  const publicReference =
    readPublicReference();

  const token =
    readVerificationToken();

  if (
    !publicReference ||
    !token
  ) {
    renderFailed(
      publicReference
    );

    return;
  }

  showState(
    "loading"
  );

  try {
    const response =
      await fetch(
        "/v2/receipts/verify",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            "Accept":
              "application/json"
          },

          body:
            JSON.stringify({
              public_reference:
                publicReference,
              token
            })
        }
      );

    if (!response.ok) {
      throw new Error(
        "Receipt verification failed."
      );
    }

    const result =
      await response.json();

    renderVerified(
      result,
      publicReference
    );
  } catch {
    renderFailed(
      publicReference
    );
  }
}

verifyReceipt();
