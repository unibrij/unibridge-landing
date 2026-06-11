// unibrij/unibridge-landing/surface/coinsph-picker.js

/*
--------------------------------------------------
CoinsPH fixed GCash / InstaPay picker

Purpose:
- Surface Card Payment PH route should match Connect PH
- no dynamic bank search for this flow
- collect only:
  - recipient legal name
  - GCash mobile wallet number
- build a clean canonical destination payload for backend

Backend canonical destination payload:
- country
- currency
- bankId
- bankName
- channelName
- channelSubject
- recipientName
- recipientAccountNumber
  - value is the GCash mobile phone number
- recipientAddress optional
- remarks optional

Compatible with:
- surface/core/coinsPhPickerBootstrap.js
--------------------------------------------------
*/

export function createCoinsPhPicker({
  root,
  continueBtn,

  onReady,
  onChange,
  onValid,
  onInvalid,
  onError,

  getDestinationCountryCode,

  /*
  --------------------------------------------------
  Backward-compatible optional args.
  Safe to keep for old callers.
  --------------------------------------------------
  */

  isPhilippinesDestination,
  setContinueDisabled
} = {}) {
  let eventsBound = false;
  let mounted = false;
  let loaded = false;

  function call(fn, ...args) {
    if (typeof fn !== "function") {
      return null;
    }

    return fn(...args);
  }

  function resolveRoot() {
    if (!root) {
      return null;
    }

    if (typeof root === "string") {
      return document.getElementById(root);
    }

    return root;
  }

  function getElement(id) {
    const resolvedRoot =
      resolveRoot();

    return (
      resolvedRoot?.querySelector?.(`#${id}`) ||
      document.getElementById(id)
    );
  }

  const bankInput =
    getElement("coinsPhBank");

  const bankSearchInput =
    getElement("coinsPhBankSearch");

  const bankResults =
    getElement("coinsPhBankResults");

  const searchCount =
    getElement("coinsPhSearchCount");

  const selectedBank =
    getElement("coinsPhSelectedBank");

  const selectedBankLabel =
    getElement("coinsPhSelectedBankLabel");

  const selectedBankMeta =
    getElement("coinsPhSelectedBankMeta");

  const channelTabs =
    getElement("coinsPhChannelTabs");

  const channelNameInput =
    getElement("coinsPhChannelName");

  const channelSubjectInput =
    getElement("coinsPhChannelSubject");

  const recipientFields =
    getElement("coinsPhRecipientFields");

  const recipientNameInput =
    getElement("coinsPhRecipientName");

  const recipientPhoneInput =
    getElement("coinsPhRecipientAccount");

  const recipientAddressInput =
    getElement("coinsPhRecipientAddress");

  const remarksInput =
    getElement("coinsPhRemarks");

  const hint =
    getElement("coinsPhHint");

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function normalizePhoneDigits(value) {
    return String(value || "")
      .replace(/[^\d]/g, "")
      .trim();
  }

  function getDestinationCountry() {
    if (typeof getDestinationCountryCode === "function") {
      return String(getDestinationCountryCode() || "")
        .toUpperCase()
        .trim();
    }

    return "";
  }

  function isActivePh() {
    if (typeof isPhilippinesDestination === "function") {
      return Boolean(isPhilippinesDestination());
    }

    const country =
      getDestinationCountry();

    return !country || country === "PH";
  }

  function setContinueStateDisabled(disabled) {
    const value =
      Boolean(disabled);

    if (continueBtn) {
      continueBtn.disabled =
        value;
    }

    call(
      setContinueDisabled,
      value
    );
  }

  function setHiddenFixedRoute() {
    if (bankInput) {
      bankInput.value =
        "gcash";
    }

    if (channelNameInput) {
      channelNameInput.value =
        "INSTAPAY";
    }

    if (channelSubjectInput) {
      channelSubjectInput.value =
        "gcash";
    }
  }

  function renderFixedRoute() {
    setHiddenFixedRoute();

    if (bankSearchInput) {
      bankSearchInput.value =
        "GCash / InstaPay";

      bankSearchInput.disabled =
        true;

      bankSearchInput.placeholder =
        "GCash / InstaPay";
    }

    if (bankResults) {
      bankResults.innerHTML =
        "";

      bankResults.classList.remove(
        "active"
      );
    }

    if (searchCount) {
      searchCount.innerText =
        "GCash / InstaPay payout route selected.";
    }

    if (selectedBank) {
      selectedBank.classList.add(
        "active"
      );
    }

    if (selectedBankLabel) {
      selectedBankLabel.innerText =
        "GCash / InstaPay";
    }

    if (selectedBankMeta) {
      selectedBankMeta.innerText =
        "INSTAPAY · gcash";
    }

    if (channelTabs) {
      channelTabs.innerHTML =
        "";

      channelTabs.classList.remove(
        "active"
      );
    }

    if (recipientFields) {
      recipientFields.classList.remove(
        "hidden"
      );

      recipientFields.style.display =
        "grid";
    }

    if (hint) {
      hint.innerText =
        "Enter the recipient name and GCash mobile number.";
    }
  }

  function validateDestinationInput() {
    if (!isActivePh()) {
      return {
        ok:
          false,

        error:
          "COINSPH_NOT_ACTIVE_DESTINATION"
      };
    }

    const recipientName =
      normalizeText(
        recipientNameInput?.value
      );

    const recipientPhoneNumber =
      normalizePhoneDigits(
        recipientPhoneInput?.value
      );

    const recipientAddress =
      normalizeText(
        recipientAddressInput?.value
      );

    const remarks =
      normalizeText(
        remarksInput?.value
      );

    if (!recipientName) {
      return {
        ok:
          false,

        error:
          "COINSPH_RECIPIENT_NAME_REQUIRED"
      };
    }

    if (recipientName.length < 2) {
      return {
        ok:
          false,

        error:
          "COINSPH_RECIPIENT_NAME_TOO_SHORT"
      };
    }

    if (recipientName.length > 80) {
      return {
        ok:
          false,

        error:
          "COINSPH_RECIPIENT_NAME_TOO_LONG"
      };
    }

    if (!recipientPhoneNumber) {
      return {
        ok:
          false,

        error:
          "COINSPH_RECIPIENT_PHONE_REQUIRED"
      };
    }

    if (recipientPhoneNumber.length < 10) {
      return {
        ok:
          false,

        error:
          "COINSPH_RECIPIENT_PHONE_TOO_SHORT"
      };
    }

    if (recipientPhoneNumber.length > 15) {
      return {
        ok:
          false,

        error:
          "COINSPH_RECIPIENT_PHONE_TOO_LONG"
      };
    }

    if (
      recipientAddress &&
      recipientAddress.length > 160
    ) {
      return {
        ok:
          false,

        error:
          "COINSPH_RECIPIENT_ADDRESS_TOO_LONG"
      };
    }

    if (
      remarks &&
      remarks.length > 120
    ) {
      return {
        ok:
          false,

        error:
          "COINSPH_REMARKS_TOO_LONG"
      };
    }

    return {
      ok:
        true,

      recipientName,

      recipientPhoneNumber,

      recipientAddress:
        recipientAddress || null,

      remarks:
        remarks || null
    };
  }

  function updateContinueState() {
    if (!isActivePh()) {
      setContinueStateDisabled(true);
      call(onInvalid);

      return false;
    }

    if (!loaded) {
      setContinueStateDisabled(true);
      call(onInvalid);

      return false;
    }

    const validation =
      validateDestinationInput();

    setContinueStateDisabled(
      !validation.ok
    );

    if (validation.ok) {
      call(
        onValid,
        validation
      );

      return true;
    }

    call(
      onInvalid,
      validation
    );

    return false;
  }

  function notifyChange() {
    call(onChange);
    updateContinueState();
  }

  async function refresh() {
    if (!isActivePh()) {
      reset();
      return false;
    }

    loaded =
      true;

    renderFixedRoute();
    updateContinueState();

    call(onReady);

    return true;
  }

  async function load() {
    return refresh();
  }

  function buildDestination() {
    const validation =
      validateDestinationInput();

    if (!validation.ok) {
      throw new Error(
        validation.error
      );
    }

    const {
      recipientName,
      recipientPhoneNumber,
      recipientAddress,
      remarks
    } =
      validation;

    const destination = {
      country:
        "PH",

      currency:
        "PHP",

      bankId:
        "gcash",

      bankName:
        "GCash",

      channelName:
        "INSTAPAY",

      channelSubject:
        "gcash",

      recipientName,

      /*
      --------------------------------------------------
      CoinsPH backend canonical field.

      For GCash / InstaPay, this value is the recipient
      mobile wallet phone number, not a bank account.
      --------------------------------------------------
      */

      recipientAccountNumber:
        recipientPhoneNumber
    };

    if (recipientAddress) {
      destination.recipientAddress =
        recipientAddress;
    }

    if (remarks) {
      destination.remarks =
        remarks;
    }

    return destination;
  }

  function reset() {
    loaded =
      false;

    if (bankInput) {
      bankInput.value =
        "";
    }

    if (channelNameInput) {
      channelNameInput.value =
        "";
    }

    if (channelSubjectInput) {
      channelSubjectInput.value =
        "";
    }

    if (bankSearchInput) {
      bankSearchInput.value =
        "";

      bankSearchInput.disabled =
        false;

      bankSearchInput.placeholder =
        "GCash / InstaPay";
    }

    if (bankResults) {
      bankResults.innerHTML =
        "";

      bankResults.classList.remove(
        "active"
      );
    }

    if (searchCount) {
      searchCount.innerText =
        "GCash / InstaPay payout route.";
    }

    if (selectedBank) {
      selectedBank.classList.remove(
        "active"
      );
    }

    if (selectedBankLabel) {
      selectedBankLabel.innerText =
        "";
    }

    if (selectedBankMeta) {
      selectedBankMeta.innerText =
        "";
    }

    if (channelTabs) {
      channelTabs.innerHTML =
        "";

      channelTabs.classList.remove(
        "active"
      );
    }

    if (recipientFields) {
      recipientFields.classList.add(
        "hidden"
      );

      recipientFields.style.display =
        "none";
    }

    if (recipientNameInput) {
      recipientNameInput.value =
        "";
    }

    if (recipientPhoneInput) {
      recipientPhoneInput.value =
        "";
    }

    if (recipientAddressInput) {
      recipientAddressInput.value =
        "";
    }

    if (remarksInput) {
      remarksInput.value =
        "";
    }

    if (hint) {
      hint.innerText =
        "Enter the recipient name and GCash mobile number.";
    }

    setContinueStateDisabled(true);
  }

  function bindEvents() {
    if (eventsBound) {
      return true;
    }

    eventsBound =
      true;

    [
      recipientNameInput,
      recipientPhoneInput,
      recipientAddressInput,
      remarksInput
    ].forEach((input) => {
      if (!input) {
        return;
      }

      input.addEventListener(
        "input",
        notifyChange
      );

      input.addEventListener(
        "blur",
        notifyChange
      );
    });

    return true;
  }

  function mount() {
    if (mounted) {
      return true;
    }

    mounted =
      true;

    bindEvents();

    if (isActivePh()) {
      refresh().catch((error) => {
        call(
          onError,
          error
        );
      });
    } else {
      reset();
    }

    return true;
  }

  return {
    mount,
    reset,
    refresh,
    load,
    bindEvents,
    updateContinueState,
    validateDestinationInput,
    buildDestination
  };
}

export default createCoinsPhPicker;
