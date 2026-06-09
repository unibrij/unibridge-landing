// fiat/bank-transfer/js/funding/bridgeCustomerGuards.js

import {
  normalizeString,
  normalizeLower,
  readNested,
  normalizeArray,
  stringifySafe
} from "./normalize.js";

const DEFAULT_BRIDGE_CUSTOMER_REJECTED_MESSAGE =
  "We could not verify this bank-transfer profile. Please try another verified account or contact support.";

export function resolveBridgeCustomerStatus(customer = {}) {
  return normalizeLower(
    customer.status ||
    customer.bridge_customer_status ||
    readNested(customer, ["customer", "status"]) ||
    readNested(customer, ["bridge_customer", "status"]) ||
    readNested(customer, ["readiness", "status"])
  );
}

export function resolveBridgeCustomerId(customer = {}) {
  return (
    normalizeString(customer.bridge_customer_id) ||
    normalizeString(readNested(customer, ["customer", "id"])) ||
    normalizeString(readNested(customer, ["bridge_customer", "id"])) ||
    normalizeString(readNested(customer, ["id"])) ||
    null
  );
}

export function resolveBridgeCustomerKycStatus(customer = {}) {
  return (
    normalizeString(customer.kyc_status) ||
    normalizeString(customer.bridge_customer_kyc_status) ||
    normalizeString(readNested(customer, ["customer", "kyc_status"])) ||
    null
  );
}

export function resolveBridgeCustomerTosStatus(customer = {}) {
  return (
    normalizeString(customer.tos_status) ||
    normalizeString(customer.bridge_customer_tos_status) ||
    normalizeString(readNested(customer, ["customer", "tos_status"])) ||
    null
  );
}

export function resolveRejectionReasons(customer = {}) {
  return [
    ...normalizeArray(customer.rejection_reasons),
    ...normalizeArray(customer.reasons),
    ...normalizeArray(
      readNested(customer, [
        "customer",
        "rejection_reasons"
      ])
    ),
    ...normalizeArray(
      readNested(customer, [
        "bridge_customer",
        "rejection_reasons"
      ])
    ),
    ...normalizeArray(
      readNested(customer, [
        "readiness",
        "rejection_reasons"
      ])
    )
  ];
}

export function resolveIssues(customer = {}) {
  return [
    ...normalizeArray(customer.issues),
    ...normalizeArray(
      readNested(customer, [
        "requirements",
        "issues"
      ])
    ),
    ...normalizeArray(
      readNested(customer, [
        "readiness",
        "issues"
      ])
    )
  ];
}

function joinReasonLikeValues(values = []) {
  return values
    .map(item => {
      if (typeof item === "string") {
        return item;
      }

      return stringifySafe(item) || "";
    })
    .join(" ")
    .toLowerCase();
}

export function hasDuplicateCustomerIssue(customer = {}) {
  const joined =
    joinReasonLikeValues([
      ...resolveIssues(customer),
      ...resolveRejectionReasons(customer)
    ]);

  return joined.includes(
    "duplicate_customer_detected"
  );
}

function hasCustomerRejectionIssue(customer = {}) {
  const joined =
    joinReasonLikeValues([
      ...resolveIssues(customer),
      ...resolveRejectionReasons(customer)
    ]);

  return (
    joined.includes("customer_rejected") ||
    joined.includes("bridge_customer_rejected") ||
    joined.includes("could not be verified")
  );
}

function isApprovedBridgeCustomerStatus(status) {
  return [
    "active",
    "approved",
    "verified",
    "complete",
    "completed"
  ].includes(
    normalizeLower(status)
  );
}

export function isRejectedBridgeCustomer(customer = {}) {
  const status =
    resolveBridgeCustomerStatus(customer);

  const rejectionReasons =
    resolveRejectionReasons(customer);

  return (
    status === "rejected" ||
    status === "failed" ||
    hasDuplicateCustomerIssue(customer) ||
    hasCustomerRejectionIssue(customer) ||
    (
      rejectionReasons.length > 0 &&
      !isApprovedBridgeCustomerStatus(status)
    )
  );
}

function isSafeUserFacingReason(reason) {
  const normalized =
    normalizeString(reason).toLowerCase();

  if (!normalized) {
    return false;
  }

  return !(
    normalized.includes("_") ||
    normalized.includes("duplicate_customer_detected") ||
    normalized.includes("vendor") ||
    normalized.includes("provider") ||
    normalized.includes("internal") ||
    normalized.includes("developer")
  );
}

export function resolveUserFacingBridgeCustomerMessage(customer = {}) {
  if (
    hasDuplicateCustomerIssue(customer)
  ) {
    return DEFAULT_BRIDGE_CUSTOMER_REJECTED_MESSAGE;
  }

  const reason =
    resolveRejectionReasons(customer)
      .map(item => {
        if (typeof item === "string") {
          return item;
        }

        return (
          normalizeString(item.message) ||
          normalizeString(item.reason)
        );
      })
      .find(isSafeUserFacingReason);

  return (
    reason ||
    DEFAULT_BRIDGE_CUSTOMER_REJECTED_MESSAGE
  );
}

export function buildBridgeCustomerRejectedResult(customer = {}) {
  return {
    ok:
      false,

    retryable:
      true,

    blocked:
      true,

    step:
      "customer",

    error:
      "bridge_customer_rejected",

    bridge_customer_id:
      resolveBridgeCustomerId(customer),

    bridge_customer_status:
      resolveBridgeCustomerStatus(customer) || "rejected",

    reason:
      resolveUserFacingBridgeCustomerMessage(customer),

    issues:
      resolveIssues(customer),

    rejection_reasons:
      resolveRejectionReasons(customer)
  };
}
