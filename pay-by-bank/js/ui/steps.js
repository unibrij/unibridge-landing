// pay-by-bank/js/ui/steps.js

export function setStepState(
  stepName,
  state
) {
  const step =
    document.querySelector(
      `.step[data-step="${stepName}"]`
    );

  if (!step) {
    return;
  }

  step.classList.remove(
    "is-active",
    "is-complete"
  );

  if (
    state ===
    "active"
  ) {
    step.classList.add(
      "is-active"
    );
  }

  if (
    state ===
    "complete"
  ) {
    step.classList.add(
      "is-complete"
    );
  }
}


export function resetSteps() {
  for (
    const step of
    document.querySelectorAll(
      ".step"
    )
  ) {
    step.classList.remove(
      "is-active",
      "is-complete"
    );
  }
}
