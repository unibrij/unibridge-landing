// unibrij/unibridge-landing/surface/core/amountGuard.js

/*
--------------------------------------------------
Surface Amount Guard

Purpose:
- keep amount limit UI handling outside app.js
- preserve existing amount-limits.js behavior
- keep send/continue button disabling centralized
- support source-country/provider based limits

Notes:
- This module does not decide routes.
- This module does not touch SmartPay / Brazil logic.
- It only delegates to applyAmountLimitUi.
--------------------------------------------------
*/

import {
  applyAmountLimitUi
} from "../amount-limits.js";

function getElement(id) {
  if (!id) {
    return null;
  }

  return document.getElementById(id);
}

function resolveButton(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return getElement(value);
  }

  return value;
}

export function refreshAmountLimitUi({
  amountInput,
  messageEl,
  continueBtn,
  sendBtn,
  provider,
  country,
  hasSettlement = false
} = {}) {
  const resolvedAmountInput =
    resolveButton(amountInput) ||
    getElement("amount");

  const resolvedMessageEl =
    resolveButton(messageEl) ||
    getElement("amountLimitHint");

  const resolvedContinueBtn =
    resolveButton(continueBtn);

  const resolvedSendBtn =
    resolveButton(sendBtn);

  const result =
    applyAmountLimitUi({
      amountInput:
        resolvedAmountInput,

      messageEl:
        resolvedMessageEl,

      continueBtn:
        resolvedContinueBtn,

      provider,
      country
    });

  /*
  --------------------------------------------------
  Quote button guard

  Before settlement creation, the send/quote button
  should follow the current amount-limit check.
  After settlement creation, do not re-enable quote
  from here.
  --------------------------------------------------
  */

  if (
    resolvedSendBtn &&
    !hasSettlement
  ) {
    resolvedSendBtn.disabled =
      !result.ok;
  }

  return result;
}

export function setAmountInputDisabled(disabled, {
  amountInput = "amount"
} = {}) {
  const input =
    resolveButton(amountInput);

  if (input) {
    input.disabled =
      Boolean(disabled);
  }
}

export function getAmountValue({
  amountInput = "amount"
} = {}) {
  const input =
    resolveButton(amountInput);

  const amount =
    Number(input?.value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("invalid_amount");
  }

  return amount;
}
