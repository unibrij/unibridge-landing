// fiat/bank-transfer/js/funding/tosStep.js

import { createBridgeTos } from "../api.js";

import {
  setStatus,
  setActiveStep,
  markStepDone
} from "../status.js";

import { normalizeString } from "./normalize.js";

function isReturnedFromBridgeTos(query = {}) {
  return (
    query.tos_accepted === "1" ||
    query.tos_accepted === "true"
  );
}

function openExternal(url) {
  const normalized =
    normalizeString(url);

  if (!normalized) {
    return false;
  }

  window.location.href =
    normalized;

  return true;
}

function resolveTosUrl(tos = {}) {
  return (
    normalizeString(tos.url) ||
    normalizeString(tos.tos_url) ||
    normalizeString(tos.link) ||
    normalizeString(tos.redirect_url) ||
    normalizeString(tos.acceptance_url) ||
    normalizeString(tos.bridge_tos_url) ||
    null
  );
}

function resolveTosStatus(tos = {}) {
  return normalizeString(
    tos.status ||
    tos.tos_status ||
    tos.bridge_tos_status ||
    tos.customer_tos_status
  ).toLowerCase();
}

function isAcceptedTosStatus(status) {
  const normalized =
    normalizeString(status).toLowerCase();

  return [
    "accepted",
    "approved",
    "complete",
    "completed"
  ].includes(
    normalized
  );
}

function shouldSkipTos({
  state = {}
} = {}) {
  return Boolean(
    state.tos_accepted === true &&
    isAcceptedTosStatus(
      state.bridge_tos_status
    )
  );
}

function markTosAccepted({
  persist
} = {}) {
  persist({
    tos_pending:
      false,

    tos_returned:
      false,

    tos_accepted:
      true,

    bridge_tos_status:
      "accepted"
  });

  markStepDone(
    "tos"
  );
}

export function markTosRequired({
  persist,
  tosStatus
} = {}) {
  persist({
    tos_pending:
      false,

    tos_returned:
      false,

    tos_accepted:
      false,

    bridge_tos_status:
      normalizeString(tosStatus) ||
      "required"
  });
}

function markTosReturnedForCheck({
  persist
} = {}) {
  persist({
    tos_pending:
      false,

    tos_returned:
      true,

    tos_accepted:
      false,

    bridge_tos_status:
      "checking"
  });
}

function buildTosRetryResult() {
  return {
    ok:
      false,

    retryable:
      true,

    step:
      "tos",

    error:
      "bridge_tos_not_accepted"
  };
}

export function showTosRequiredStatus() {
  setActiveStep(
    "tos"
  );

  setStatus({
    kind:
      "warning",

    message:
      "Bridge terms must be accepted before creating the funding profile. Please retry to continue terms acceptance."
  });
}

export async function runTosStep({
  settlementId,
  state,
  query,
  persist
}) {
  if (
    shouldSkipTos({
      state
    })
  ) {
    markTosAccepted({
      persist
    });

    return {
      skipped:
        true
    };
  }

  setActiveStep(
    "tos"
  );

  /*
    Important:
    tos_accepted=1 in the URL only means the user returned
    from the Bridge ToS page. It is not proof that Bridge
    accepted the terms for this settlement/customer context.
  */
  if (
    isReturnedFromBridgeTos(
      query
    )
  ) {
    markTosReturnedForCheck({
      persist
    });
  }

  const tos =
    await createBridgeTos({
      settlement_id:
        settlementId
    });

  const tosStatus =
    resolveTosStatus(
      tos
    );

  if (
    isAcceptedTosStatus(
      tosStatus
    )
  ) {
    markTosAccepted({
      persist
    });

    return {
      ok:
        true,

      accepted:
        true
    };
  }

  const tosUrl =
    resolveTosUrl(
      tos
    );

  if (tosUrl) {
    persist({
      tos_pending:
        true,

      tos_returned:
        false,

      tos_accepted:
        false,

      bridge_tos_status:
        tosStatus ||
        "pending",

      tos_url:
        tosUrl
    });

    setStatus({
      kind:
        "warning",

      message:
        "Redirecting to accept Bridge terms…"
    });

    if (
      !openExternal(
        tosUrl
      )
    ) {
      throw new Error(
        "missing_tos_redirect_url"
      );
    }

    return {
      redirected:
        true,

      step:
        "tos"
    };
  }

  markTosRequired({
    persist,
    tosStatus
  });

  return buildTosRetryResult();
}
