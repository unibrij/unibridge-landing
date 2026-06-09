// fiat/bank-transfer/js/funding/bridgeBankTransferErrors.js

import {
  normalizeString,
  normalizeLower
} from "./normalize.js";

const DEFAULT_BANK_TRANSFER_CREATE_FAILED_ERROR =
  "bridge_bank_transfer_create_failed";

const DEFAULT_BANK_TRANSFER_NOT_READY_MESSAGE =
  "Your funding profile is not ready for bank-transfer instructions yet. Please refresh status or contact support.";

export function resolveErrorStatus(err = {}) {
  return normalizeLower(
    err.status ||
    err.statusCode ||
    err.codeStatus ||
    err.error?.status ||
    err.error?.statusCode ||
    err.response?.status ||
    err.response?.statusCode ||
    err.response?.data?.status ||
    err.data?.status ||
    err.body?.status
  );
}

export function resolveErrorCode(err = {}) {
  return normalizeLower(
    err.code ||
    err.error?.code ||
    err.response?.data?.code ||
    err.data?.code ||
    err.body?.code ||
    err.body?.error ||
    err.body?.reason ||
    err.body?.state
  );
}

export function resolveErrorMessage(err = {}) {
  return normalizeLower(
    err.message ||
    err.error?.message ||
    err.response?.data?.message ||
    err.data?.message ||
    err.body?.message ||
    err.body?.reason ||
    err.body?.state ||
    err.error
  );
}

export function resolveReadableErrorMessage(err = {}) {
  return (
    normalizeString(err.message) ||
    normalizeString(err.error?.message) ||
    normalizeString(err.response?.data?.message) ||
    normalizeString(err.data?.message) ||
    normalizeString(err.body?.message) ||
    normalizeString(err.body?.reason) ||
    normalizeString(err.body?.state) ||
    normalizeString(err.error) ||
    DEFAULT_BANK_TRANSFER_CREATE_FAILED_ERROR
  );
}

export function isBridgeTosNotAcceptedError(err = {}) {
  const message =
    normalizeLower(
      err.message ||
      err.error?.message ||
      err.error
    );

  const code =
    normalizeLower(
      err.code ||
      err.error?.code
    );

  return (
    message === "bridge_tos_not_accepted" ||
    code === "bridge_tos_not_accepted"
  );
}

export function isBridgeCustomerRejectedError(err = {}) {
  const message =
    resolveErrorMessage(err);

  const code =
    resolveErrorCode(err);

  const status =
    resolveErrorStatus(err);

  return (
    status === "409" ||
    status === "conflict" ||
    status === "rejected" ||
    code === "409" ||
    code === "conflict" ||
    code === "bridge_customer_rejected" ||
    code === "duplicate_customer_detected" ||
    message.includes("bridge_customer_rejected") ||
    message.includes("duplicate_customer_detected") ||
    message.includes("your information could not be verified")
  );
}

export function resolveCustomerFromError(err = {}) {
  return (
    err.response?.data ||
    err.data ||
    err.body ||
    err.response ||
    err.error ||
    err
  );
}

export function resolveUserFacingBankTransferMessage(err = {}) {
  const raw =
    resolveReadableErrorMessage(err);

  const normalizedRaw =
    normalizeLower(raw);

  const status =
    resolveErrorStatus(err);

  const code =
    resolveErrorCode(err);

  if (
    normalizedRaw === DEFAULT_BANK_TRANSFER_CREATE_FAILED_ERROR ||
    status === "409" ||
    status === "conflict" ||
    code === "409" ||
    code === "conflict" ||
    normalizedRaw.startsWith("bridge_customer_") ||
    code.startsWith("bridge_customer_")
  ) {
    return DEFAULT_BANK_TRANSFER_NOT_READY_MESSAGE;
  }

  return raw;
}

export function buildBankTransferCreateFailedResult(err = {}) {
  return {
    ok:
      false,

    retryable:
      true,

    blocked:
      true,

    step:
      "instructions",

    error:
      DEFAULT_BANK_TRANSFER_CREATE_FAILED_ERROR,

    status:
      resolveErrorStatus(err) || null,

    code:
      resolveErrorCode(err) || null,

    reason:
      resolveUserFacingBankTransferMessage(err)
  };
}
