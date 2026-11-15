// unibridge-landing-main/fiat/bank-transfer/js/bankSelectorView.js

import {
  createDestinationSelect
} from "../../../shared/pay/destination/selectRenderer.js";

import {
  validConnectorId,
  hasPaymentFlow,
  terminalFlow,
  getDiscovery,
  paymentMessage
} from "./paymentRules.js";

const str = value =>
  String(value ?? "").trim();

export function normalizeBanks(response) {
  const items = Array.isArray(response)
    ? response
    : Array.isArray(response?.banks)
      ? response.banks
      : Array.isArray(response?.data?.banks)
        ? response.data.banks
        : Array.isArray(response?.data)
          ? response.data
          : [];

  const seen = new Set();

  return items
    .map(item => ({
      id: validConnectorId(
        item?.connectorId ??
        item?.connectorID ??
        item?.connector_id ??
        item?.id
      ),
      name: str(
        item?.fullname ||
        item?.name ||
        item?.bankName ||
        item?.bank_name ||
        item?.displayName
      )
    }))
    .filter(item => {
      if (
        item.id === null ||
        !item.name ||
        seen.has(item.id)
      ) {
        return false;
      }

      seen.add(item.id);
      return true;
    })
    .sort((a, b) =>
      a.name.localeCompare(b.name)
    );
}

export function safeUrl(value) {
  try {
    const url = new URL(str(value));

    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password
    )
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function createSelector(field, options) {
  return createDestinationSelect({
    field,
    options,
    applyCommonAttributes(select) {
      select.name = field.name;
    }
  });
}

function closeSelector(selector) {
  if (
    selector?.element?.classList.contains("is-open")
  ) {
    selector.element
      .querySelector(".destination-select-trigger")
      ?.click();
  }
}

function disableSelector(selector, disabled) {
  if (!selector) return;

  if (disabled) {
    closeSelector(selector);
  }

  selector.input.disabled = disabled;

  const trigger = selector.element.querySelector(
    ".destination-select-trigger"
  );

  if (trigger) {
    trigger.disabled = disabled;
  }
}

export function createBankSelectorView({
  element,
  countries,
  isCurrent,
  onBankChange
} = {}) {
  if (
    !element ||
    !countries ||
    typeof isCurrent !== "function"
  ) {
    throw new Error(
      "exthand_bank_view_context_missing"
    );
  }

  element.innerHTML = `
    <h4>Pay directly from your bank</h4>
    <p>
      Choose your bank and authorize
      your payment securely.
    </p>

    <div class="destination-field">
      <label class="destination-field-label">
        Bank country
      </label>
      <div data-bank-country-slot></div>
    </div>

    <div class="destination-field">
      <label class="destination-field-label">
        Your bank
      </label>
      <div data-bank-select-slot></div>
    </div>

    <button
      type="button"
      data-bank-pay
      disabled
    >
      Continue to bank
    </button>

    <button
      type="button"
      data-bank-refresh
    >
      Check payment status
    </button>

    <p
      data-bank-message
      role="status"
      aria-live="polite"
    ></p>

    <div data-bank-next></div>

    <p>
      You can also use the manual transfer
      instructions above. Do not pay twice.
    </p>
  `;

  const find = selector =>
    element.querySelector(selector);

  const countrySlot = find(
    "[data-bank-country-slot]"
  );

  const bankSlot = find(
    "[data-bank-select-slot]"
  );

  const pay = find("[data-bank-pay]");
  const refresh = find("[data-bank-refresh]");
  const message = find("[data-bank-message]");
  const next = find("[data-bank-next]");

  const countrySelector = createSelector(
    {
      name: "exthand_bank_country",
      label: "Bank country",
      placeholder: "Select country",
      searchable: false
    },
    Object.entries(countries).map(
      ([code, name]) => ({
        value: code,
        label: name
      }))
  );

  countrySlot.append(countrySelector.element);

  let bankSelector = null;
  let availableBankIds = new Set();
  let selectorsDisabled = true;
  let destroyed = false;

  const active = () =>
    !destroyed && isCurrent();

  const country = countrySelector.input;

  const getBank = () =>
    bankSelector?.input;

  // The orchestrator must explicitly enable
  // selection after verifying payment state.
  disableSelector(countrySelector, true);

  function setMessage(value) {
    if (!active()) return;

    message.textContent = str(value);
  }

  function selectedBankId() {
    return validConnectorId(
      getBank()?.value
    );
  }

  function selectedBankValid() {
    const bankId = selectedBankId();

    return (
      bankId !== null &&
      availableBankIds.has(bankId)
    );
  }

  function replaceBankSelector(banks = []) {
    if (!active()) return null;

    closeSelector(bankSelector);

    availableBankIds = new Set(
      banks.map(bank => bank.id)
    );

    bankSelector = createSelector(
      {
        name: "exthand_bank",
        label: "Bank",
        placeholder: "Select bank",
        searchable: true
      },
      banks.map(bank => ({
        value: String(bank.id),
        label: bank.name
      }))
    );

    bankSlot.replaceChildren(
      bankSelector.element
    );

    if (typeof onBankChange === "function") {
      bankSelector.input.addEventListener(
        "change",
        () => {
          if (active()) {
            onBankChange();
          }
        }
      );
    }

    // Preserve the last disabled state
    // across selector replacement.
    disableSelector(
      bankSelector,
      selectorsDisabled ||
        availableBankIds.size === 0
    );

    return bankSelector.input;
  }

  function setSelectorsDisabled(disabled) {
    if (!active()) return;

    selectorsDisabled = Boolean(disabled);

    disableSelector(
      countrySelector,
      selectorsDisabled
    );

    disableSelector(
      bankSelector,
      selectorsDisabled ||
        availableBankIds.size === 0
    );
  }

  function setPayButton({
    disabled = true,
    continuing = false
  } = {}) {
    if (!active()) return;

    pay.disabled = Boolean(disabled);

    pay.textContent = continuing
      ? "Continue bank payment"
      : "Continue to bank";
  }

  function renderResult(result) {
    if (!active()) return;

    setMessage(paymentMessage(result));

    next.replaceChildren();

    const flow = result?.flow || {};

    if (terminalFlow(flow)) {
      return;
    }

    // Gateway consent redirects must be read
    // directly from the top-level flow.
    // Payment actions take precedence over
    // earlier discovery redirects.
    const action =
      result?.outcome === "gateway_consent_required"
        ? flow.next_action
        : hasPaymentFlow(result)
          ? flow.next_action
          : getDiscovery(result)?.next_action;

    if (action?.type !== "redirect") {
      return;
    }

    const url = safeUrl(action.url);

    if (!url) {
      setMessage(
        "Invalid bank authorization link. Do not retry payment."
      );
      return;
    }

    const link = document.createElement("a");

    link.href = url;

    link.textContent =
      "Open your bank to approve payment";

    link.rel = "noopener noreferrer";

    next.append(link);
  }

  function destroy() {
    if (destroyed) return;

    destroyed = true;

    closeSelector(countrySelector);
    closeSelector(bankSelector);

    availableBankIds.clear();
  }

  return {
    country,
    pay,
    refresh,

    getBank,
    selectedBankId,
    selectedBankValid,

    replaceBankSelector,
    setSelectorsDisabled,
    setPayButton,
    setMessage,
    renderResult,
    destroy
  };
}
