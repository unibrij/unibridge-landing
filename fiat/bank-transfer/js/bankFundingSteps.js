// fiat/bank-transfer/js/bankFundingSteps.js

import {
  createBridgeTos,
  createBridgeCustomer,
  createBridgeBankTransfer
} from "./api.js";

import {
  renderBankInstructions
} from "./instructions.js";

import {
  requireCustomerProfile
} from "./customerProfile.js";

import {
  runKyc
} from "./kycFlow.js";

import {
  setStatus,
  setActiveStep,
  markStepDone,
  showWaitingForFunding
} from "./status.js";

function normalizeString(value) {
  return String(value || "").trim();
}

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

function shouldSkipTos({
  state = {},
  query = {}
} = {}) {
  return Boolean(
    state.tos_accepted ||
    state.bridge_tos_status === "accepted" ||
    isReturnedFromBridgeTos(query)
  );
}

async function runTos({
  settlementId,
  state,
  query,
  persist
}) {
  if (
    shouldSkipTos({
      state,
      query
    })
  ) {
    persist({
      tos_pending:
        false,

      tos_accepted:
        true,

      bridge_tos_status:
        "accepted"
    });

    markStepDone(
      "tos"
    );

    return {
      skipped:
        true
    };
  }

  setActiveStep(
    "tos"
  );

  const tos =
    await createBridgeTos({
      settlement_id:
        settlementId
    });

  const tosUrl =
    tos.url ||
    tos.tos_url ||
    tos.link;

  if (tosUrl) {
    persist({
      tos_pending:
        true,

      tos_url:
        tosUrl
    });

    setStatus({
      kind:
        "warning",

      message:
        "Redirecting to accept Bridge terms…"
    });

    if (!openExternal(tosUrl)) {
      throw new Error(
        "missing_tos_redirect_url"
      );
    }

    return {
      redirected:
        true
    };
  }

  persist({
    tos_accepted:
      true,

    bridge_tos_status:
      "accepted"
  });

  markStepDone(
    "tos"
  );

  return {
    ok:
      true
  };
}

async function runBridgeCustomer({
  settlementId,
  persist
}) {
  setActiveStep(
    "customer"
  );

  const customerProfile =
    requireCustomerProfile();

  const customer =
    await createBridgeCustomer({
      settlement_id:
        settlementId,

      customer:
        customerProfile
    });

  persist({
    bridge_customer_id:
      customer.bridge_customer_id,

    bridge_customer_status:
      customer.status || null,

    bridge_customer_kyc_status:
      customer.kyc_status || null,

    bridge_customer_tos_status:
      customer.tos_status || null
  });

  markStepDone(
    "customer"
  );

  return customer;
}

async function runBridgeBankTransfer({
  settlementId,
  state,
  persist,
  instructionsBox
}) {
  setActiveStep(
    "instructions"
  );

  const funding =
    await createBridgeBankTransfer({
      settlement_id:
        settlementId,

      source_country:
        state.source_country,

      source_rail:
        state.source_rail
    });

  persist({
    bridge_transfer_id:
      funding.bridge_transfer_id,

    bridge_transfer_state:
      funding.bridge_transfer_state,

    latest_funding_response:
      funding
  });

  renderBankInstructions(
    instructionsBox,
    funding
  );

  markStepDone(
    "instructions"
  );

  showWaitingForFunding();

  return funding;
}

export async function runBankFundingSteps({
  settlementId,
  state,
  query,
  persist,
  instructionsBox,
  onConfirm
}) {
  setActiveStep(
    "kyc"
  );

  const kycResult =
    await runKyc({
      settlementId,
      state,
      persist,
      onConfirm
    });

  if (kycResult.redirected) {
    return {
      redirected:
        true,

      step:
        "kyc"
    };
  }

  const tosResult =
    await runTos({
      settlementId,
      state,
      query,
      persist
    });

  if (tosResult.redirected) {
    return {
      redirected:
        true,

      step:
        "tos"
    };
  }

  await runBridgeCustomer({
    settlementId,
    persist
  });

  const funding =
    await runBridgeBankTransfer({
      settlementId,
      state,
      persist,
      instructionsBox
    });

  return {
    ok:
      true,

    funding
  };
}
