// fiat/bank-transfer/js/providers/coinsphProviderDestination.js

import {
  createCoinsPhPicker
} from "../../../../shared/coinsph/coinsph-picker.js";

import {
  loadCoinsPhProviderChannelOptions
} from "./coinsphProviderApi.js";

let picker = null;
let activeRoute = null;
let latestValidation = null;

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeLower(value) {
  return normalizeString(value).toLowerCase();
}

function getExecutor(route = {}) {
  return normalizeLower(
    route.executor ||
      route.execution_provider ||
      route.provider
  );
}

export function isCoinsPhProviderRoute(route = {}) {
  return Boolean(
    getExecutor(route) === "coinsph" ||
      route.channelName ||
      route.channelSubject
  );
}

function buildShell() {
  return `
    <div class="coinsph-bank-transfer-destination">
      <input id="coinsPhBank" type="hidden" />
      <input id="coinsPhChannelName" type="hidden" />
      <input id="coinsPhChannelSubject" type="hidden" />

      <label class="field">
        <span>Recipient institution</span>
        <input
          id="coinsPhBankSearch"
          type="text"
          autocomplete="off"
          placeholder="Search bank or payout institution"
        />
      </label>

      <div id="coinsPhSearchCount" class="field-hint">
        Search for the receiving bank.
      </div>

      <div id="coinsPhBankResults" class="coinsph-results"></div>

      <div id="coinsPhSelectedBank" class="coinsph-selected-bank">
        <strong id="coinsPhSelectedBankLabel"></strong>
        <span id="coinsPhSelectedBankMeta"></span>
      </div>

      <div id="coinsPhChannelTabs" class="coinsph-channel-tabs"></div>

      <div id="coinsPhRecipientFields" class="coinsph-recipient-fields hidden">
        <label class="field">
          <span>Recipient full legal name</span>
          <input
            id="coinsPhRecipientName"
            type="text"
            autocomplete="name"
            required
          />
        </label>

        <label class="field">
          <span>Recipient account number</span>
          <input
            id="coinsPhRecipientAccount"
            type="text"
            inputmode="numeric"
            required
          />
        </label>

        <label class="field">
          <span>Recipient address</span>
          <input
            id="coinsPhRecipientAddress"
            type="text"
            autocomplete="street-address"
          />
        </label>

        <label class="field">
          <span>Remarks</span>
          <input
            id="coinsPhRemarks"
            type="text"
          />
        </label>
      </div>

      <div id="coinsPhHint" class="field-hint">
        Search for the receiving bank or wallet, select the payout channel, then enter recipient details.
      </div>
    </div>
  `;
}

export function renderCoinsPhProviderDestination({
  container,
  route,
  onChange
} = {}) {
  if (!container) {
    return false;
  }

  if (!isCoinsPhProviderRoute(route)) {
    return false;
  }

  activeRoute =
    route || null;

  latestValidation =
    null;

  container.innerHTML =
    buildShell();

  picker =
    createCoinsPhPicker({
      root:
        container,

      loadChannelOptions:
        loadCoinsPhProviderChannelOptions,

      getDestinationCountryCode:
        () => "PH",

      isPhilippinesDestination:
        () => true,

      onChange:
        () => {
          latestValidation =
            picker?.validateDestinationInput?.() || null;

          if (typeof onChange === "function") {
            onChange({
              route:
                activeRoute,

              validation:
                latestValidation
            });
          }
        },

      onValid:
        (validation) => {
          latestValidation =
            validation;
        },

      onInvalid:
        (validation) => {
          latestValidation =
            validation || null;
        },

      onError:
        (err) => {
          console.error(
            "BANK_TRANSFER_COINSPH_PROVIDER_FAILED",
            err
          );
        }
    });

  picker.mount();

  return true;
}

export function collectCoinsPhProviderDestination(route = {}) {
  if (!isCoinsPhProviderRoute(route)) {
    return null;
  }

  if (!picker) {
    throw new Error(
      "COINSPH_PROVIDER_PICKER_NOT_READY"
    );
  }

  return picker.buildDestination();
}

export function resetCoinsPhProviderDestination() {
  activeRoute =
    null;

  latestValidation =
    null;

  picker?.reset?.();

  picker =
    null;
}
