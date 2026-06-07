// fiat/bank-transfer/js/flowErrors.js

export function normalizeString(value) {
  return String(value || "").trim();
}

export function resolveErrorMessage(error) {
  if (!error) {
    return "Unexpected error";
  }

  if (typeof error === "string") {
    return error;
  }

  const code =
    normalizeString(
      error.code ||
      error.error?.code ||
      (
        typeof error.error === "string"
          ? error.error
          : ""
      )
    );

  if (code === "get_quote_first") {
    return "Please get a quote first.";
  }

  if (code === "fiat_bank_customer_auth_subject_mismatch") {
    return "This payout route belongs to another signed-in account. Please start a new payout route.";
  }

  if (error.message) {
    return error.message;
  }

  if (error.error?.message) {
    return error.error.message;
  }

  if (code) {
    return code;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unexpected error";
  }
}
