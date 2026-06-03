// fiat/bank-transfer/js/status.js

const STEP_ORDER = [
  "kyc",
  "tos",
  "customer",
  "instructions",
  "waiting"
];

function normalizeString(value) {
  return String(value || "").trim();
}

function getStepEl(step) {
  return document.querySelector(
    `.step[data-step="${step}"]`
  );
}

export function setStatus({
  message,
  kind
} = {}) {
  const statusBox =
    document.getElementById("statusBox");

  if (!statusBox) {
    return;
  }

  statusBox.textContent =
    normalizeString(message) ||
    "Processing…";

  statusBox.className =
    "status-box" + (kind ? ` ${kind}` : "");
}

export function setPrimaryAction({
  label,
  disabled
} = {}) {
  const button =
    document.getElementById("primaryAction");

  if (!button) {
    return;
  }

  if (label) {
    button.textContent = label;
  }

  button.disabled =
    Boolean(disabled);
}

export function setRefreshAction({
  disabled
} = {}) {
  const button =
    document.getElementById("refreshStatus");

  if (!button) {
    return;
  }

  button.disabled =
    Boolean(disabled);
}

export function setStepState(step, state) {
  const el =
    getStepEl(step);

  if (!el) {
    return;
  }

  el.classList.remove(
    "active",
    "done",
    "failed"
  );

  if (state) {
    el.classList.add(state);
  }
}

export function setActiveStep(activeStep) {
  let reached = false;

  for (const step of STEP_ORDER) {
    if (step === activeStep) {
      reached = true;
      setStepState(step, "active");
      continue;
    }

    setStepState(
      step,
      reached ? null : "done"
    );
  }
}

export function markStepDone(step) {
  setStepState(step, "done");
}

export function markStepFailed(step) {
  setStepState(step, "failed");
}

export function resetSteps() {
  for (const step of STEP_ORDER) {
    setStepState(step, null);
  }
}

export function showWaitingForFunding() {
  setActiveStep("waiting");

  setStatus({
    kind: "warning",
    message:
      "Waiting for the bank transfer. UniBridge will continue once funding is confirmed on Polygon."
  });

  setPrimaryAction({
    label: "Instructions generated",
    disabled: true
  });
}
