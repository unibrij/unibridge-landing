// unibrij/unibridge-landing/surface/core/formEvents.js

/*
--------------------------------------------------
Surface Form Events

Purpose:
- keep DOM event wiring outside app.js
- bind amount/source/country/recipient field events
- delegate all behavior to callbacks from app.js
- avoid payment/session/route logic here

Notes:
- This module does not start flows.
- This module does not create settlements.
- This module does not create funding sessions.
- This module does not touch Brazil / SmartPay.
--------------------------------------------------
*/

function getElement(id) {
  if (!id) {
    return null;
  }

  return document.getElementById(id);
}

function resolveElement(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return getElement(value);
  }

  return value;
}

function call(fn, ...args) {
  if (typeof fn !== "function") {
    return null;
  }

  return fn(...args);
}

function addListener(target, eventName, handler) {
  const el =
    resolveElement(target);

  if (
    !el ||
    !eventName ||
    typeof handler !== "function"
  ) {
    return null;
  }

  el.addEventListener(
    eventName,
    handler
  );

  return function removeListener() {
    el.removeEventListener(
      eventName,
      handler
    );
  };
}

function bindInput(target, handler) {
  return addListener(
    target,
    "input",
    handler
  );
}

function bindChange(target, handler) {
  return addListener(
    target,
    "change",
    handler
  );
}

function bindClick(target, handler) {
  return addListener(
    target,
    "click",
    handler
  );
}

export function bindSurfaceFormEvents({
  amountInput,
  sourceCountryInput,
  destinationCountryInput,
  sendBtn,
  continueBtn,
  coinsPhContinueBtn,
  resetBtn,

  onAmountInput,
  onSourceCountryChange,
  onDestinationCountryChange,
  onSendClick,
  onContinueClick,
  onCoinsPhContinueClick,
  onResetClick
} = {}) {
  const removers = [];

  const push =
    (remover) => {
      if (typeof remover === "function") {
        removers.push(remover);
      }
    };

  push(
    bindInput(
      amountInput,
      () => call(onAmountInput)
    )
  );

  push(
    bindChange(
      sourceCountryInput,
      () => call(onSourceCountryChange)
    )
  );

  push(
    bindChange(
      destinationCountryInput,
      () => call(onDestinationCountryChange)
    )
  );

  push(
    bindClick(
      sendBtn,
      (event) => {
        event.preventDefault();
        call(onSendClick, event);
      }
    )
  );

  push(
    bindClick(
      continueBtn,
      (event) => {
        event.preventDefault();
        call(onContinueClick, event);
      }
    )
  );

  push(
    bindClick(
      coinsPhContinueBtn,
      (event) => {
        event.preventDefault();
        call(onCoinsPhContinueClick, event);
      }
    )
  );

  push(
    bindClick(
      resetBtn,
      (event) => {
        event.preventDefault();
        call(onResetClick, event);
      }
    )
  );

  return function unbindSurfaceFormEvents() {
    removers.forEach((remove) => {
      remove();
    });

    return true;
  };
}
