// unibridge-landing-main/fiat/bank-transfer/js/paymentRules.js

const str = value =>
  String(value ?? "").trim();

const lower = value =>
  str(value).toLowerCase();

const isObject = value =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value);

export function validConnectorId(value) {
  if (
    value === null ||
    value === undefined ||
    !str(value)
  ) {
    return null;
  }

  const id = Number(value);

  return Number.isSafeInteger(id) && id > 0
    ? id
    : null;
}

export function getDiscovery(result) {
  const discovery =
    result?.account_discovery ||
    result?.discovery;

  return isObject(discovery)
    ? discovery
    : null;
}

export function discoveryStatus(result) {
  return lower(
    getDiscovery(result)?.status ||
    result?.discovery_status
  );
}

export function isDiscovery(result) {
  return Boolean(
    discoveryStatus(result) ||
    [
      "account_discovery_started",
      "account_discovery_already_started",
      "account_discovery_status",
      "account_discovery_already_completed",
      "account_discovery_updated"
    ].includes(result?.outcome)
  );
}

export function hasPaymentFlow(result) {
  const flow = result?.flow;

  if (!isObject(flow)) {
    return false;
  }

  return Boolean(
    flow.payment ||
    flow.flow_state ||
    flow.next_action
  );
}

export function discoveryReady(result) {
  return (
    !hasPaymentFlow(result) &&
    discoveryStatus(result) === "accounts_ready" &&
    getDiscovery(result)?.account_ready === true
  );
}

export function needsSelection(result) {
  return (
    !hasPaymentFlow(result) &&
    discoveryStatus(result) ===
      "accounts_selection_required"
  );
}

export function safeToRetry(result) {
  const submission =
    result?.connected_bank_submission;

  const cleanSubmission =
    submission == null ||
    (
      isObject(submission) &&
      Object.keys(submission).length === 0
    );

  return (
    result?.outcome === "payment_not_started" &&
    result?.initiation_safe_to_retry === true &&
    !isDiscovery(result) &&
    !hasPaymentFlow(result) &&
    cleanSubmission
  );
}

export function terminalFlow(flow = {}) {
  return (
    flow.payment?.terminal === true ||
    ["done", "error"].includes(flow.flow_state) ||
    flow.payment?.state === "failed"
  );
}

export function paymentMessage(result) {
  if (result?.outcome === "payment_not_started") {
    return safeToRetry(result)
      ? "Select your bank to continue."
      : "Payment initiation could not be confirmed. Check its status before retrying.";
  }

  const flow = result?.flow || {};
  const payment = flow.payment || {};

  if (hasPaymentFlow(result)) {
    if (payment.state === "accepted") {
      return "Bank payment accepted. Waiting for Bridge to confirm receipt of funds.";
    }

    if (
      payment.state === "failed" ||
      flow.flow_state === "error"
    ) {
      return "The bank payment did not complete. Check its status before taking further action.";
    }

    if (flow.flow_state === "decoupled") {
      return "Approve the payment in your banking app, then check its status.";
    }

    if (
      flow.flow_state === "unsupported_interaction"
    ) {
      return "This bank requires an unsupported interaction. Do not initiate another payment.";
    }

    if (terminalFlow(flow)) {
      return "Bank payment processing has ended. Check the settlement status before taking further action.";
    }

    return "Bank payment is pending or its outcome is not yet confirmed. Check payment status.";
  }

  if (needsSelection(result)) {
    return "Bank authorization completed. Account selection is required before continuing with payment.";
  }

  if (discoveryReady(result)) {
    return "Bank account authorization completed. Continue to initiate your bank payment.";
  }

  if (isDiscovery(result)) {
    const status = discoveryStatus(result);

    if (status === "redirect") {
      return "Complete bank authorization, then check its status.";
    }

    if (status === "decoupled") {
      return "Approve access in your banking app, then check its status.";
    }

    if ([
      "initiation_unknown",
      "finalization_unknown",
      "initiating",
      "finalizing"
    ].includes(status)) {
      return "Bank authorization outcome is not yet confirmed. Do not start another attempt.";
    }

    if ([
      "initiation_rejected",
      "error"
    ].includes(status)) {
      return "Bank authorization could not be completed. Check its status before taking further action.";
    }

    if (status === "interaction_required") {
      return "This bank requires an unsupported authorization interaction.";
    }

    if (status === "retry") {
      return "Bank authorization requires continuation. Check its status before taking further action.";
    }

    return "Bank authorization is in progress. Check its status.";
  }

  if (result?.started === false) {
    return "A previous bank payment attempt exists. Check its status before taking further action.";
  }

  return "Bank payment status is not confirmed. Check payment status.";
}
