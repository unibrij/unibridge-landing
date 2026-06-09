// fiat/bank-transfer/js/funding/bridgeCustomerStep.js

import { createBridgeCustomer } from "../api.js";

import { requireCustomerProfile } from "../customerProfile.js";

import {
  setStatus,
  setActiveStep,
  markStepDone,
  markStepFailed
} from "../status.js";

import {
  resolveBridgeCustomerId,
  resolveBridgeCustomerStatus,
  resolveBridgeCustomerKycStatus,
  resolveBridgeCustomerTosStatus,
  resolveRejectionReasons,
  resolveIssues,
  isRejectedBridgeCustomer,
  resolveUserFacingBridgeCustomerMessage,
  buildBridgeCustomerRejectedResult
} from "./bridgeCustomerGuards.js";

import {
  isBridgeTosNotAcceptedError,
  isBridgeCustomerRejectedError,
  resolveCustomerFromError,
  resolveReadableErrorMessage
} from "./bridgeBankTransferErrors.js";

import { stringifySafe } from "./normalize.js";
import { markTosRequired } from "./tosStep.js";

function clearInstructionsBox(instructionsBox) {
  if (!instructionsBox) {
    return;
  }

  instructionsBox.innerHTML = "";
  instructionsBox.classList.add("hidden");
}

function showBridgeCustomerRejectedStatus(customer = {}) {
  setActiveStep("customer");
  markStepFailed("customer");

  setStatus({
    kind: "error",
    message: resolveUserFacingBridgeCustomerMessage(customer)
  });
}

function buildTosRequiredFromCustomerResult() {
  return {
    ok:
      false,

    retryable:
      true,

    blocked:
      true,

    step:
      "tos",

    error:
      "bridge_tos_not_accepted"
  };
}

function persistBridgeCustomerSnapshot({
  persist,
  customer,
  fallbackStatus = null,
  error = null
}) {
  const rejectionReasons =
    resolveRejectionReasons(customer);

  const issues =
    resolveIssues(customer);

  persist({
    bridge_customer_id:
      resolveBridgeCustomerId(customer),

    bridge_customer_status:
      resolveBridgeCustomerStatus(customer) ||
      fallbackStatus,

    bridge_customer_kyc_status:
      resolveBridgeCustomerKycStatus(customer) ||
      null,

    bridge_customer_tos_status:
      resolveBridgeCustomerTosStatus(customer) ||
      null,

    bridge_customer_rejection_reasons:
      rejectionReasons,

    bridge_customer_issues:
      issues,

    bridge_customer_rejection_reasons_json:
      stringifySafe(rejectionReasons),

    bridge_customer_issues_json:
      stringifySafe(issues),

    bridge_customer_error:
      error || null
  });
}

export async function runBridgeCustomerStep({
  settlementId,
  persist,
  instructionsBox
}) {
  setActiveStep(
    "customer"
  );

  const customerProfile =
    requireCustomerProfile();

  try {
    const customer =
      await createBridgeCustomer({
        settlement_id:
          settlementId,

        customer:
          customerProfile
      });

    persistBridgeCustomerSnapshot({
      persist,
      customer,
      fallbackStatus:
        null,
      error:
        null
    });

    if (
      isRejectedBridgeCustomer(customer)
    ) {
      clearInstructionsBox(
        instructionsBox
      );

      showBridgeCustomerRejectedStatus(
        customer
      );

      return buildBridgeCustomerRejectedResult(
        customer
      );
    }

    markStepDone(
      "customer"
    );

    return {
      ok:
        true,

      customer
    };
  } catch (err) {
    if (
      isBridgeTosNotAcceptedError(err)
    ) {
      markTosRequired({
        persist,
        tosStatus:
          "required"
      });

      return buildTosRequiredFromCustomerResult();
    }

    if (
      isBridgeCustomerRejectedError(err)
    ) {
      const customer =
        resolveCustomerFromError(err);

      clearInstructionsBox(
        instructionsBox
      );

      persistBridgeCustomerSnapshot({
        persist,
        customer,
        fallbackStatus:
          "rejected",

        error:
          resolveReadableErrorMessage(err)
      });

      showBridgeCustomerRejectedStatus(
        customer
      );

      return buildBridgeCustomerRejectedResult(
        customer
      );
    }

    throw err;
  }
}
